"""Firmware releases, combined device warnings and the firmware flow trigger."""

from __future__ import annotations

import json
from typing import Any

from lib.homey.firmware import FirmwareCatalog, FirmwareRelease, is_newer, version_key
from lib.homey.flow_cards import Cards, FlowCards
from lib.homey.warnings import DeviceWarnings
from tests.fakes import FakeFlow, RecordingLogger

MANIFEST: dict[str, Any] = {
    "name": "S1 Pro Multi Sense",
    "version": "v1.3.0",
    "builds": [
        {"chipFamily": "ESP32", "ota": {"summary": "Other chip"}},
        {
            "chipFamily": "ESP32-C3",
            "ota": {
                "path": "https://example.invalid/v1.3.0.ota.bin",
                "release_url": "https://github.com/sensy-one/S1-Pro-Multi-Sense/releases/tag/v1.3.0",
                "summary": "New things",
            },
        },
    ],
}


class Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


class TestVersions:
    def test_version_key(self) -> None:
        assert version_key("v1.2.21") == (1, 2, 21)
        assert version_key(" 2.0 ") == (2, 0)
        assert version_key("dev") is None

    def test_is_newer(self) -> None:
        assert is_newer("v1.2.22", "v1.2.21")
        assert is_newer("v1.10.0", "v1.9.9")
        assert not is_newer("v1.2.21", "v1.2.21")
        assert not is_newer("v1.2.20", "v1.2.21")
        assert not is_newer("v1.3.0", "")


class TestFirmwareCatalog:
    async def test_reads_and_caches_the_manifest(self) -> None:
        requests: list[str] = []
        clock = Clock()

        async def fetch(url: str) -> bytes:
            requests.append(url)

            return json.dumps(MANIFEST).encode()

        catalog = FirmwareCatalog(RecordingLogger(), fetch=fetch, clock=clock)

        release = await catalog.latest()
        assert release == FirmwareRelease(
            version="v1.3.0",
            release_url="https://github.com/sensy-one/S1-Pro-Multi-Sense/releases/tag/v1.3.0",
            summary="New things",
        )

        await catalog.latest()
        assert len(requests) == 1

        clock.now += FirmwareCatalog.CACHE_SECONDS
        await catalog.latest()
        assert requests == [FirmwareCatalog.MANIFEST_URL, FirmwareCatalog.MANIFEST_URL]

    async def test_failures_are_logged_and_retried_later(self) -> None:
        logger = RecordingLogger()

        async def fetch(url: str) -> bytes:
            raise OSError(f"offline: {url}")

        catalog = FirmwareCatalog(logger, fetch=fetch, clock=Clock())

        assert await catalog.latest() is None
        assert len(logger.errors) == 1

    def test_parse_tolerates_odd_manifests(self) -> None:
        assert FirmwareCatalog.parse([]) is None
        assert FirmwareCatalog.parse({"version": "latest"}) is None
        assert FirmwareCatalog.parse({"version": "v2.0.0", "builds": "none"}) == FirmwareRelease("v2.0.0", "", "")
        assert FirmwareCatalog.parse({"version": "v2.0.0", "builds": ["x"]}) == FirmwareRelease("v2.0.0", "", "")


class WarningRecorder:
    def __init__(self) -> None:
        self.shown: list[str | None] = []

    async def set_warning(self, message: str | None = None) -> None:
        self.shown.append(message)

    async def unset_warning(self) -> None:
        self.shown.append(None)


class TestDeviceWarnings:
    async def test_combines_and_clears_messages(self) -> None:
        host = WarningRecorder()
        warnings = DeviceWarnings(host)

        await warnings.raise_warning("proxy", "Proxy on")
        await warnings.raise_warning("proxy", "Proxy on")
        await warnings.raise_warning("firmware", "Update available")
        await warnings.clear("proxy")
        await warnings.clear("proxy")
        await warnings.clear("firmware")

        assert host.shown == ["Proxy on", "Proxy on\nUpdate available", "Update available", None]


class TestFirmwareTrigger:
    async def test_triggers_with_tokens(self) -> None:
        flow = FakeFlow()
        cards = FlowCards(flow, RecordingLogger()).register()

        await cards.firmware_available("device", "v1.3.0", "v1.2.21")

        assert flow.cards[Cards.FIRMWARE_AVAILABLE].triggers == [
            ("device", {"version": "v1.3.0", "installed": "v1.2.21"}, {}),
        ]

    async def test_failures_are_logged(self) -> None:
        flow = FakeFlow()
        logger = RecordingLogger()
        cards = FlowCards(flow, logger).register()

        flow.cards[Cards.FIRMWARE_AVAILABLE].fail = True
        await cards.firmware_available("device", "v1.3.0", "v1.2.21")

        assert len(logger.errors) == 1

    async def test_without_registration(self) -> None:
        await FlowCards(FakeFlow(), RecordingLogger()).firmware_available("device", "v1.3.0", "v1.2.21")
