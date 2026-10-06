"""What devices need from the app, without importing ``app.py``."""

from __future__ import annotations

from typing import Protocol

from ..homey.firmware import FirmwareCatalog
from ..homey.realtime_hub import RealtimeHub


class SensyAppPort(Protocol):
    """The app-wide services a device uses."""

    @property
    def realtime(self) -> RealtimeHub: ...

    @property
    def firmware(self) -> FirmwareCatalog: ...

    def publish_devices(self) -> None:
        """Tell the web views that the list of sensors (or their status) changed."""
