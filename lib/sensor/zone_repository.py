"""Persists zone outlines and per-zone options on the sensor."""

from __future__ import annotations

from dataclasses import dataclass

from lib.sensor.polygon import Point, Polygon
from lib.sensor.ports import EntityPort
from lib.sensor.profile import Range, S1ProProfile
from lib.sensor.zone import Zone
from lib.utils import clamp, round_half_up, to_finite_number


@dataclass(frozen=True, slots=True)
class ZoneOptions:
    presence_delay: float
    """Seconds presence is held after the last detection."""

    movement_threshold: float
    """Minimum speed (cm/s) that counts as movement."""


class ZoneRepository:
    """Reads and writes zones through the entity port.

    The firmware stores a polygon as a point count plus up to eight
    ``pN_x``/``pN_y`` numbers.
    """

    def __init__(self, port: EntityPort) -> None:
        self._port = port

    def read(self, zone: Zone) -> Polygon | None:
        """Return the outline, or ``None`` while not all values have been received."""
        count = self._port.get(zone.entity("points_count"))

        if count is None:
            return None

        size = min(round_half_up(to_finite_number(count, 0.0)), Polygon.MAX_POINTS)

        if size < Polygon.MIN_POINTS:
            return Polygon.EMPTY

        points: list[Point] = []

        for index in range(1, size + 1):
            x = self._port.get(zone.entity(f"p{index}_x"))
            y = self._port.get(zone.entity(f"p{index}_y"))

            if x is None or y is None:
                return None

            points.append((round_half_up(to_finite_number(x, 0.0)), round_half_up(to_finite_number(y, 0.0))))

        return Polygon.parse(points)

    def is_configured(self, zone: Zone) -> bool:
        """Whether the zone has a usable outline."""
        polygon = self.read(zone)

        if polygon is None:
            return False

        return not polygon.is_empty

    def write(self, zone: Zone, polygon: Polygon) -> None:
        """Write an outline.

        The zone is disabled while its points are rewritten, so the firmware
        never evaluates a half-updated polygon.
        """
        port = self._port

        port.set_number(zone.entity("points_count"), 0)

        for index, (x, y) in enumerate(polygon.points, start=1):
            port.set_number(zone.entity(f"p{index}_x"), x)
            port.set_number(zone.entity(f"p{index}_y"), y)

        if not polygon.is_empty:
            port.set_number(zone.entity("points_count"), polygon.size)

    def read_options(self, zone: Zone) -> ZoneOptions:
        """Return the options of a detection zone."""
        presence_delay = self._port.get(zone.entity("presence_delay"))
        movement_threshold = self._port.get(zone.entity("movement_threshold"))

        return ZoneOptions(
            presence_delay=to_finite_number(presence_delay, 0.0),
            movement_threshold=to_finite_number(movement_threshold, 0.0),
        )

    def write_options(
        self,
        zone: Zone,
        *,
        presence_delay: object = None,
        movement_threshold: object = None,
    ) -> None:
        """Write the given options of a detection zone; ``None`` leaves an option untouched."""
        if presence_delay is not None:
            seconds = self._bounded(presence_delay, S1ProProfile.PRESENCE_DELAY)

            self._port.set_number(zone.entity("presence_delay"), seconds)

        if movement_threshold is not None:
            speed = self._bounded(movement_threshold, S1ProProfile.MOVEMENT_THRESHOLD)

            self._port.set_number(zone.entity("movement_threshold"), speed)

    @staticmethod
    def _bounded(value: object, bounds: Range) -> float:
        number = to_finite_number(value, bounds.minimum)

        return clamp(number, bounds.minimum, bounds.maximum)
