"""Several independent warnings on one Homey device."""

from __future__ import annotations

from typing import Protocol


class WarningHost(Protocol):
    """The subset of ``homey.device.Device`` used for warnings."""

    async def set_warning(self, message: str | None = None) -> None: ...

    async def unset_warning(self) -> None: ...


class DeviceWarnings:
    """Homey shows one warning per device; this combines the active ones.

    Each source (Bluetooth proxy, firmware update, ...) raises or clears its own
    message by key; the device shows them together, in the order they were raised.
    """

    def __init__(self, host: WarningHost) -> None:
        self._host = host
        self._messages: dict[str, str] = {}

    async def raise_warning(self, key: str, message: str) -> None:
        if self._messages.get(key) == message:
            return

        self._messages[key] = message
        await self._show()

    async def clear(self, key: str) -> None:
        if self._messages.pop(key, None) is None:
            return

        await self._show()

    async def _show(self) -> None:
        if not self._messages:
            await self._host.unset_warning()

            return

        await self._host.set_warning("\n".join(self._messages.values()))
