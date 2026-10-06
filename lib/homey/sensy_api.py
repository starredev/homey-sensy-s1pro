"""Application service behind the web API and the widget API."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

from ..errors import NotFoundError, ValidationError
from ..homey.presenter import SensorPresenter, SensorView
from ..sensor.polygon import Polygon
from ..sensor.zone import Zone


class SensyApi:
    """Resolves sensors, validates untrusted input and delegates to the domain."""

    def __init__(self, sensors: Callable[[], list[SensorView]]) -> None:
        """
        Args:
            sensors: Lists the paired sensors.
        """
        self._sensors = sensors

    def list_devices(self) -> list[dict[str, Any]]:
        devices: list[dict[str, Any]] = []

        for view in self._sensors():
            devices.append(SensorPresenter.summary(view))

        return devices

    def get_snapshot(self, device_id: str | None) -> dict[str, Any] | None:
        """Return the snapshot of a sensor.

        Args:
            device_id: Omit to get the first sensor (a widget without a selection).

        Returns:
            ``None`` when no sensor is paired.
        """
        view = self._find_or_first(device_id)

        if view is None:
            return None

        return SensorPresenter.snapshot(view)

    def set_zone(self, device_id: str | None, zone: str | None, body: object) -> dict[str, Any]:
        """Write a zone outline; ``{"points": []}`` clears the zone."""
        target = Zone.of(zone)
        fields = self._as_object(body)
        polygon = Polygon.parse(fields.get("points", []))

        self._find(device_id).sensor.set_zone_outline(target, polygon)

        return {
            "zone": target.key,
            "points": polygon.to_json(),
        }

    def set_zone_options(self, device_id: str | None, zone: str | None, body: object) -> dict[str, Any]:
        """Write ``{"presenceDelay"?, "movementThreshold"?}`` of a detection zone."""
        target = Zone.detection(zone)
        fields = self._as_object(body)

        self._find(device_id).sensor.set_zone_options(
            target,
            presence_delay=fields.get("presenceDelay"),
            movement_threshold=fields.get("movementThreshold"),
        )

        return {"zone": target.key}

    def _find(self, device_id: str | None) -> SensorView:
        for view in self._sensors():
            if view.id == device_id:
                return view

        raise NotFoundError("Sensor not found")

    def _find_or_first(self, device_id: str | None) -> SensorView | None:
        if device_id:
            return self._find(device_id)

        views = self._sensors()

        if not views:
            return None

        return views[0]

    @staticmethod
    def _as_object(body: object) -> Mapping[str, Any]:
        if body is None:
            return {}

        if not isinstance(body, Mapping):
            raise ValidationError("Expected a JSON object")

        return body  # pyright: ignore[reportUnknownVariableType]
