"""Everything that is specific to the Sensy-One S1 Pro firmware.

Entity ids, which entity feeds which capability and which entity backs which
setting. Supporting another firmware revision should only require changes
here.

Both the official Sensy-One firmware and the Homey edition are supported; they
share all entities except the ones that report live target positions.

Object ids are the ones ``aioesphomeapi`` reports. They can differ from other
ESPHome clients for names with non-ASCII characters (``CO₂`` becomes ``co_``).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from types import MappingProxyType

from ..sensor.bindings import (
    NumberSettingBinding,
    SettingBinding,
    SwitchSettingBinding,
    TargetFeed,
    TrackedEntity,
)
from ..sensor.ports import EntityValue
from ..sensor.zone import Zone
from ..utils import round_half_up, to_finite_number


@dataclass(frozen=True, slots=True)
class Range:
    minimum: float
    maximum: float


def _official_empty(x: float, y: float) -> bool:
    return x == 0 and y == 0


def _homey_edition_empty(x: float, y: float) -> bool:
    return x < -9000 or y < -9000


def _as_bool(value: EntityValue) -> bool:
    return bool(value)


def _as_count(value: EntityValue) -> float:
    return round_half_up(to_finite_number(value, 0.0))


def _zone_settings() -> list[SettingBinding]:
    """Presence hold time and movement threshold of every detection zone."""
    bindings: list[SettingBinding] = []

    for zone in Zone.DETECTION:
        bindings.append(NumberSettingBinding(f"zone{zone.number}_presence_delay", zone.entity("presence_delay")))
        bindings.append(
            NumberSettingBinding(f"zone{zone.number}_movement_threshold", zone.entity("movement_threshold"))
        )

    return bindings


class S1ProProfile:
    """Firmware profile of the S1 Pro Multi Sense."""

    PROJECT_NAME = "Sensy-One.S1 Pro Multi Sense"
    """ESPHome ``project.name``; keep in sync with ``.homeycompose/discovery/sensy-s1pro.json``."""

    CLIENT_INFO = "Homey Sensy S1 Pro"
    """Name the sensor shows for the Homey connection."""

    PRESENCE = "any_presence"
    MOVEMENT = "any_movement"
    PEOPLE = "all_targets_count"
    DETECTION_RANGE = "detection_range"
    BUZZER = "mlt8530___buzzer"

    AIR_QUALITY = "bme688_iaq_classification"
    """Text: Excellent, Good, Lightly polluted, ... (see ``AirQuality``)."""

    IAQ_ACCURACY = "bme688_iaq_accuracy"
    """Text: Stabilizing, Uncertain, Calibrating or Calibrated."""

    BLUETOOTH_PROXY = "ble___proxy"
    """Official firmware only: Bluetooth proxy for Home Assistant, off by default."""

    ZONE_STATE = re.compile(r"zone_([1-3])_(presence|movement|target_count)")
    """``zone_1_presence`` -> zone 1, kind presence."""

    ZONE_GEOMETRY = re.compile(r"(?:zone_[1-3]|exclusion_zone)_(?:points_count|p[1-8]_[xy])")
    """Any entity that changes the outline of a zone."""

    TARGET_FEEDS = (
        # Official firmware: the radar's own sensors. Every frame publishes x then y; (0, 0) means empty.
        TargetFeed(
            name="official",
            pattern=re.compile(r"target_([1-3])_([xy])"),
            empty=_official_empty,
            complete_on="y",
        ),
        # Homey edition: light template sensors, each sent only when it moved; -9999 means empty.
        TargetFeed(
            name="homey-edition",
            pattern=re.compile(r"live_t([1-3])_([xy])"),
            empty=_homey_edition_empty,
        ),
    )

    TRACKED = (
        TrackedEntity(PRESENCE, _as_bool),
        TrackedEntity(MOVEMENT, _as_bool),
        TrackedEntity(PEOPLE, _as_count),
    )
    """Entities whose values drive flows and the radar."""

    CAPABILITIES: MappingProxyType[str, str | None] = MappingProxyType(
        {
            PRESENCE: None,
            MOVEMENT: None,
            PEOPLE: "sensy_people",
            "bme688_temperature": None,
            "bme688_humidity": None,
            "bme688_pressure": None,
            "bme688_iaq": "sensy_iaq",
            AIR_QUALITY: "sensy_air_quality",
            IAQ_ACCURACY: "sensy_iaq_accuracy",
            "bme688_voc_equivalent": None,
            "scd40_co__concentration": None,
            "ltr390_ambient_light__lux_": None,
            "ltr390_uv_index": None,
        }
    )
    """Primary entities shown as capabilities: object id -> capability id,
    or ``None`` to keep the capability ``homey-esphomedriver`` picks.

    Everything else without an entity category (zone geometry, target feeds,
    entities mirrored as settings) stays off the device.
    """

    HIDDEN = frozenset(
        {
            "esp32___factory_reset",
            "radar___factory_reset",
            "scd40___factory_reset",
        }
    )
    """Diagnostic or configuration entities never shown, not even on request."""

    SETTINGS: tuple[SettingBinding, ...] = (
        NumberSettingBinding("detection_range", DETECTION_RANGE),
        NumberSettingBinding("any_presence_delay", "any_presence_delay"),
        NumberSettingBinding("any_movement_threshold", "any_movement_threshold"),
        *_zone_settings(),
        NumberSettingBinding("bme688_temp_offset", "bme688_temp_offset"),
        NumberSettingBinding("scd40_temp_offset", "scd40_temp_offset"),
        NumberSettingBinding("lux_offset", "ltr390_lux_offset"),
        NumberSettingBinding("uv_offset", "ltr390_uv_offset"),
        SwitchSettingBinding("single_target", "radar___single_target"),
        # Tracking ("holding engine") of the official firmware.
        NumberSettingBinding("stationary_speed_threshold", "radar_stationary_speed_threshold"),
        NumberSettingBinding("stationary_time", "radar_stationary_time"),
        NumberSettingBinding("dropout_hold_time", "radar_dropout_hold_time"),
        NumberSettingBinding("gate_radius", "radar_gate_radius"),
    )

    PRESENCE_DELAY = Range(0, 3600)
    MOVEMENT_THRESHOLD = Range(0, 5000)
    BEEP_SECONDS = Range(0.1, 5)
    BEEP_FALLBACK_SECONDS = 0.3
    DEFAULT_DETECTION_RANGE = 600
