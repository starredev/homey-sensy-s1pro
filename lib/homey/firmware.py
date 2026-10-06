"""Which firmware Sensy-One has released, read from its GitHub releases."""

from __future__ import annotations

import asyncio
import json
import re
import time
import urllib.request
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, ClassVar

from ..utils import Logger

type Fetch = Callable[[str], Awaitable[bytes]]

_VERSION = re.compile(r"v?(\d+(?:\.\d+)*)")


@dataclass(frozen=True, slots=True)
class FirmwareRelease:
    version: str
    """As the firmware reports it, e.g. ``v1.2.21``."""

    release_url: str
    summary: str


def version_key(version: str) -> tuple[int, ...] | None:
    """``"v1.2.21"`` -> ``(1, 2, 21)``; ``None`` for anything that is not a version."""
    match = _VERSION.fullmatch(version.strip())

    if match is None:
        return None

    parts: list[int] = []

    for part in match.group(1).split("."):
        parts.append(int(part))

    return tuple(parts)


def is_newer(candidate: str, installed: str) -> bool:
    """Whether ``candidate`` is a later version than ``installed``; ``False`` when either is unknown."""
    candidate_key = version_key(candidate)
    installed_key = version_key(installed)

    if candidate_key is None or installed_key is None:
        return False

    return candidate_key > installed_key


async def _download(url: str) -> bytes:
    def read() -> bytes:
        request = urllib.request.Request(url, headers={"User-Agent": "homey-sensy-s1pro"})

        with urllib.request.urlopen(request, timeout=15) as response:
            body: bytes = response.read()

        return body

    return await asyncio.to_thread(read)


class FirmwareCatalog:
    """The latest official release, fetched at most every few hours.

    The sensor can check for updates itself, but its HTTPS request costs so much
    memory on the ESP32-C3 that it rarely gets an answer; Homey checks instead.
    """

    MANIFEST_URL: ClassVar[str] = (
        "https://github.com/sensy-one/S1-Pro-Multi-Sense/releases/latest/download/manifest.json"
    )

    CHIP_FAMILY: ClassVar[str] = "ESP32-C3"

    CACHE_SECONDS: ClassVar[float] = 6 * 3600

    def __init__(
        self,
        logger: Logger,
        *,
        fetch: Fetch = _download,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._logger = logger
        self._fetch = fetch
        self._clock = clock
        self._lock = asyncio.Lock()
        self._release: FirmwareRelease | None = None
        self._fetched_at: float | None = None

    async def latest(self) -> FirmwareRelease | None:
        """The latest release, or ``None`` when GitHub could not be read."""
        async with self._lock:
            if self._is_fresh():
                return self._release

            self._release = await self._load()
            self._fetched_at = self._clock()

            return self._release

    def _is_fresh(self) -> bool:
        if self._fetched_at is None:
            return False

        return self._clock() - self._fetched_at < self.CACHE_SECONDS

    async def _load(self) -> FirmwareRelease | None:
        try:
            body = await self._fetch(self.MANIFEST_URL)
            manifest: Any = json.loads(body)
        except Exception as error:  # noqa: BLE001 - offline or GitHub hiccup: try again next time
            self._logger.error(f"Could not read the firmware manifest: {error}")

            return None

        return self.parse(manifest)

    @classmethod
    def parse(cls, manifest: Any) -> FirmwareRelease | None:
        """The release in an ESP Web Tools manifest, for the S1 Pro's chip."""
        if not isinstance(manifest, dict):
            return None

        fields: dict[str, Any] = manifest  # pyright: ignore[reportUnknownVariableType]
        version = fields.get("version")

        if not isinstance(version, str) or version_key(version) is None:
            return None

        ota = cls._ota(fields.get("builds"))

        return FirmwareRelease(
            version=version,
            release_url=str(ota.get("release_url") or ""),
            summary=str(ota.get("summary") or ""),
        )

    @classmethod
    def _ota(cls, builds: Any) -> dict[str, Any]:
        if not isinstance(builds, list):
            return {}

        for build in builds:  # pyright: ignore[reportUnknownVariableType]
            if not isinstance(build, dict):
                continue

            entry: dict[str, Any] = build  # pyright: ignore[reportUnknownVariableType]
            ota = entry.get("ota")

            if entry.get("chipFamily") == cls.CHIP_FAMILY and isinstance(ota, dict):
                return ota  # pyright: ignore[reportUnknownVariableType]

        return {}
