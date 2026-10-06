"""Bindings between ESPHome entities and the concepts of the app."""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field

from ..sensor.ports import EntityPort, EntityValue
from ..sensor.target_tracker import Axis
from ..utils import round_to, to_finite_number

type SettingValue = bool | float | str


@dataclass(frozen=True, slots=True)
class TrackedEntity:
    """An entity whose value the sensor model tracks, with its conversion."""

    object_id: str
    convert: Callable[[EntityValue], bool | float]


@dataclass(frozen=True, slots=True)
class TargetFeed:
    """A family of entities that reports live target positions.

    One entity per axis and target slot. Firmware variants name these entities
    differently and mark an empty slot differently, so each variant gets its
    own feed.
    """

    name: str
    """For logs and tests."""

    pattern: re.Pattern[str]
    """Object id pattern; group 1 = slot (1-3), group 2 = axis (``x``/``y``)."""

    empty: Callable[[float, float], bool] = field(repr=False)
    """Whether a position means "no target"."""

    complete_on: Axis | None = None
    """For feeds that always send both axes in a fixed order: the axis that
    completes a position. Until it arrives, a half-updated position is not shown."""

    def is_empty(self, x: float, y: float) -> bool:
        return self.empty(x, y)

    def completes(self, axis: Axis) -> bool:
        """Whether an update of this axis completes a position."""
        if self.complete_on is None:
            return True

        return axis == self.complete_on


@dataclass(frozen=True, slots=True)
class SettingBinding(ABC):
    """Two-way binding between a Homey device setting and an ESPHome entity.

    Subclasses implement how the value is read from and written to the sensor.
    """

    key: str
    """Homey setting id (Homey reserves the ``zone_`` prefix, hence ``zone1_...``)."""

    object_id: str

    @abstractmethod
    def from_sensor(self, raw: EntityValue) -> SettingValue:
        """Convert a value reported by the sensor into a setting value."""

    @abstractmethod
    def write(self, port: EntityPort, value: SettingValue) -> None:
        """Write a setting value to the sensor."""

    def read(self, port: EntityPort) -> SettingValue | None:
        """Return the setting value, or ``None`` while the sensor has not reported it."""
        raw = port.get(self.object_id)

        if raw is None:
            return None

        return self.from_sensor(raw)


_ONE_DECIMAL = round_to(1)


@dataclass(frozen=True, slots=True)
class NumberSettingBinding(SettingBinding):
    """A ``number:`` entity, mirrored with one decimal."""

    def from_sensor(self, raw: EntityValue) -> SettingValue:
        return _ONE_DECIMAL(raw)

    def write(self, port: EntityPort, value: SettingValue) -> None:
        port.set_number(self.object_id, to_finite_number(value, 0.0))


@dataclass(frozen=True, slots=True)
class SwitchSettingBinding(SettingBinding):
    """A ``switch:`` entity, mirrored as a checkbox."""

    def from_sensor(self, raw: EntityValue) -> SettingValue:
        return bool(raw)

    def write(self, port: EntityPort, value: SettingValue) -> None:
        port.set_switch(self.object_id, bool(value))
