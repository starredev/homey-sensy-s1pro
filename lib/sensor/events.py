"""Domain events raised by the sensor model.

They describe *what happened* in the room; the Homey layer decides which flow
cards they translate to.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..sensor.air_quality import AirQuality
from ..sensor.zone import Zone


class SensorEvent:
    """Base class of all domain events."""


@dataclass(frozen=True, slots=True)
class PresenceChanged(SensorEvent):
    """The room became occupied, or became empty."""

    present: bool
    people: int
    """Number of people detected when the change happened."""


@dataclass(frozen=True, slots=True)
class PeopleCountChanged(SensorEvent):
    """The number of people in the room changed."""

    people: int
    previous: int


@dataclass(frozen=True, slots=True)
class ZonePresenceChanged(SensorEvent):
    """Someone entered a zone, or the zone became empty."""

    zone: Zone
    present: bool
    people: int
    """Number of people in the zone."""


@dataclass(frozen=True, slots=True)
class ZoneMovementChanged(SensorEvent):
    """Movement started or stopped inside a zone."""

    zone: Zone
    moving: bool


@dataclass(frozen=True, slots=True)
class AirQualityChanged(SensorEvent):
    """The air quality class changed."""

    quality: AirQuality
    previous: AirQuality
