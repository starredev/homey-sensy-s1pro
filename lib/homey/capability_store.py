"""Write-through access to a device's capabilities."""

from __future__ import annotations

from typing import Any, Protocol

from ..utils import Logger


class CapabilityHost(Protocol):
    """The subset of ``homey.device.Device`` this store relies on."""

    def has_capability(self, id: str) -> bool: ...

    def get_capability_value(self, id: str) -> Any: ...

    async def set_capability_value(self, id: str, value: Any) -> None: ...

    async def add_capability(self, id: str) -> None: ...

    async def remove_capability(self, id: str) -> None: ...

    async def set_capability_options(self, id: str, options: dict[str, Any]) -> None: ...


class CapabilityStore:
    """Skips no-op writes, which keeps Insights free of duplicate points."""

    def __init__(self, host: CapabilityHost, logger: Logger) -> None:
        self._host = host
        self._logger = logger

    def has(self, capability: str) -> bool:
        return self._host.has_capability(capability)

    def get(self, capability: str) -> Any:
        """Return the current value, or ``None`` when the device lacks the capability."""
        if not self._host.has_capability(capability):
            return None

        return self._host.get_capability_value(capability)

    async def set(self, capability: str, value: Any) -> None:
        """Set a value when the capability exists and the value differs.

        Failures are logged, never raised: a stale reading must not break the stream.
        """
        if not self._host.has_capability(capability):
            return

        if self._host.get_capability_value(capability) == value:
            return

        try:
            await self._host.set_capability_value(capability, value)
        except Exception as error:  # noqa: BLE001 - any SDK failure is only logged
            self._logger.error(f"Could not set {capability}:", error)

    async def add(self, capability: str, options: dict[str, Any]) -> None:
        if self._host.has_capability(capability):
            return

        await self._host.add_capability(capability)
        await self._host.set_capability_options(capability, options)

    async def remove(self, capability: str) -> None:
        if self._host.has_capability(capability):
            await self._host.remove_capability(capability)
