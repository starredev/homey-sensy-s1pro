"""Two-way sync between device settings and the sensor's configuration entities."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol

from ..errors import NotConnectedError
from ..sensor.bindings import SettingValue
from ..sensor.profile import S1ProProfile
from ..sensor.sensor import S1ProSensor


class SettingsHost(Protocol):
    """The subset of ``homey.device.Device`` used for settings."""

    def get_settings(self) -> Mapping[str, Any]: ...

    async def set_settings(self, settings: dict[str, Any]) -> None: ...


def _sensor_settings() -> frozenset[str]:
    keys: set[str] = set()

    for binding in S1ProProfile.SETTINGS:
        keys.add(binding.key)

    return frozenset(keys)


class SettingsMirror:
    """Keeps device settings and sensor entities in sync, in both directions.

    User edits are pushed to the sensor, and changes made on the sensor itself
    (web UI, Home Assistant, another app) are pulled back.
    """

    SENSOR_SETTINGS = _sensor_settings()
    """Device settings that are backed by an entity on the sensor."""

    def __init__(self, host: SettingsHost, sensor: S1ProSensor) -> None:
        self._host = host
        self._sensor = sensor

    async def pull(self) -> None:
        """Copy sensor values that differ from the current settings into the settings."""
        current = self._host.get_settings()
        changed: dict[str, Any] = {}

        for key, value in self._sensor.read_settings().items():
            if current.get(key) != value:
                changed[key] = value

        if changed:
            await self._host.set_settings(changed)

    def push(self, settings: Mapping[str, SettingValue | None], changed_keys: tuple[str, ...]) -> None:
        """Write changed settings to the sensor.

        Called from ``on_settings``, so a raised error is shown to the user and
        the change is rolled back.

        Raises:
            NotConnectedError: When a sensor setting changed while the sensor is offline.
        """
        entries: list[tuple[str, SettingValue]] = []

        for key in changed_keys:
            value = settings.get(key)

            if key in self.SENSOR_SETTINGS and value is not None:
                entries.append((key, value))

        if not entries:
            return

        if not self._sensor.connected:
            raise NotConnectedError()

        self._sensor.apply_settings(entries)
