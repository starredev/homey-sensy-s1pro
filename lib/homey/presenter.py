"""The JSON contracts of the web API and the realtime channels.

The widget and the zone editor consume these shapes, so they are kept stable.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from ..sensor.sensor import S1ProSensor
from ..sensor.zone import Zone


@dataclass(frozen=True, slots=True)
class SensorView:
    """Read model the presenter needs from a device."""

    id: str
    """Stable device id (the sensor's MAC address)."""

    name: str
    sensor: S1ProSensor
    capability_value: Callable[[str], Any]


ENVIRONMENT = {
    "temperature": "measure_temperature",
    "humidity": "measure_humidity",
    "co2": "measure_co2",
    "iaq": "sensy_iaq",
    "lux": "measure_luminance",
}
"""Environment readings included in a snapshot, keyed by their API name."""


class SensorPresenter:
    """Maps the sensor model onto plain JSON."""

    @staticmethod
    def summary(view: SensorView) -> dict[str, Any]:
        return {
            "id": view.id,
            "name": view.name,
            "connected": view.sensor.connected,
        }

    @classmethod
    def live(cls, view: SensorView) -> dict[str, Any]:
        """Pushed on the ``sensy.live`` channel, several times per second."""
        sensor = view.sensor
        zones: list[dict[str, Any]] = []

        for zone in Zone.DETECTION:
            zones.append(cls._live_zone(sensor, zone))

        return {
            "id": view.id,
            "connected": sensor.connected,
            "targets": cls._targets(sensor),
            "targetStates": cls._target_states(sensor),
            "presence": sensor.present,
            "moving": sensor.moving,
            "people": sensor.people,
            "zones": zones,
        }

    @classmethod
    def snapshot(cls, view: SensorView) -> dict[str, Any]:
        """Full state for the widget and the zone editor."""
        snapshot = cls.live(view)

        snapshot["name"] = view.name
        snapshot["detectionRange"] = view.sensor.detection_range
        snapshot["zones"] = cls._zones(view.sensor)
        snapshot["env"] = cls._environment(view)

        return snapshot

    @staticmethod
    def _targets(sensor: S1ProSensor) -> list[list[int] | None]:
        targets: list[list[int] | None] = []

        for position in sensor.targets:
            if position is None:
                targets.append(None)
            else:
                targets.append([position[0], position[1]])

        return targets

    @staticmethod
    def _target_states(sensor: S1ProSensor) -> list[str | None]:
        """``moving``, ``stationary`` or ``held`` per slot; ``None`` when unknown or empty."""
        states: list[str | None] = []

        for state in sensor.target_states:
            if state is None:
                states.append(None)
            else:
                states.append(state.value)

        return states

    @staticmethod
    def _live_zone(sensor: S1ProSensor, zone: Zone) -> dict[str, Any]:
        status = sensor.zone_status(zone)

        return {
            "zone": zone.number,
            "presence": status.presence,
            "movement": status.movement,
            "people": status.people,
        }

    @staticmethod
    def _zones(sensor: S1ProSensor) -> dict[str, dict[str, Any]]:
        """Keyed by zone key (``1``, ``2``, ``3``, ``exclusion``)."""
        zones: dict[str, dict[str, Any]] = {}

        for zone in Zone.ALL:
            outline = sensor.zone_outline(zone)
            points = [] if outline is None else outline.to_json()

            if zone.is_exclusion:
                zones[zone.key] = {"points": points}
                continue

            options = sensor.zone_options(zone)

            zones[zone.key] = {
                "points": points,
                "presenceDelay": options.presence_delay,
                "movementThreshold": options.movement_threshold,
            }

        return zones

    @staticmethod
    def _environment(view: SensorView) -> dict[str, Any]:
        environment: dict[str, Any] = {}

        for key, capability in ENVIRONMENT.items():
            environment[key] = view.capability_value(capability)

        return environment
