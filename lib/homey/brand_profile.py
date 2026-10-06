"""The ``homey-esphomedriver`` brand profile of the S1 Pro."""

from __future__ import annotations

import dataclasses
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from aioesphomeapi import EntityCategory, EntityInfo
from homey_esphomedriver.esphome_types import HomeyEspHomeDeviceOption
from homey_esphomedriver.profile import BrandProfile

from ..sensor.profile import S1ProProfile
from .zone_capabilities import ZoneCapabilities


def _setting_entities() -> frozenset[str]:
    """Entities that are already device settings; never also a capability."""
    object_ids: set[str] = set()

    for binding in S1ProProfile.SETTINGS:
        object_ids.add(binding.object_id)

    return frozenset(object_ids)


_SETTING_ENTITIES = _setting_entities()

_ZONE_ENTITIES = ZoneCapabilities.entity_capabilities()


@dataclass(frozen=True, slots=True)
class MaintenanceButton:
    """An ESPHome button offered as a maintenance action on the device.

    ``homey-esphomedriver`` presses the entity itself for any ``button.*``
    capability that carries the entity key.
    """

    object_id: str
    capability: str
    title: dict[str, str]
    description: dict[str, str] | None = None

    def options(self, key: int) -> dict[str, object]:
        options: dict[str, object] = {
            "key": key,
            "entity_type": "button",
            "maintenanceAction": True,
            "title": self.title,
        }

        if self.description is not None:
            options["desc"] = self.description

        return options


MAINTENANCE_BUTTONS = (
    MaintenanceButton(
        S1ProProfile.CO2_CALIBRATION,
        "button.calibrate_co2",
        {"en": "Calibrate CO₂ sensor", "nl": "CO₂-sensor kalibreren"},
        {
            "en": "Sets the CO₂ reading to 426 ppm (outdoor air). Only use this after the sensor has been "
            "in fresh outdoor air for at least 3 minutes.",
            "nl": "Zet de CO₂-meting op 426 ppm (buitenlucht). Gebruik dit alleen als de sensor minstens "
            "3 minuten in frisse buitenlucht heeft gestaan.",
        },
    ),
    MaintenanceButton(
        S1ProProfile.RESTART,
        "button.restart",
        {"en": "Restart sensor", "nl": "Sensor herstarten"},
    ),
    MaintenanceButton(
        S1ProProfile.RADAR_RESTART,
        "button.restart_radar",
        {"en": "Restart radar", "nl": "Radar herstarten"},
    ),
)

_MAINTENANCE_ENTITIES = frozenset(button.object_id for button in MAINTENANCE_BUTTONS)


@dataclass(frozen=True, slots=True)
class SensyBrandProfile(BrandProfile):
    """Tells ``homey-esphomedriver`` which S1 Pro entities become capabilities.

    The sensor reports about 150 entities; most of them (zone geometry, target
    feeds, tuning numbers) have no entity category, so the generic mapping
    would put them all on the device tile. Here, entities without a category
    are only mapped when :attr:`S1ProProfile.CAPABILITIES` lists them, or when
    they report the state of a zone in :attr:`drawn_zones`; the app handles
    targets and settings itself. Diagnostic and configuration entities keep the
    library behaviour: hidden until the user enables them in the device settings.

    The driver holds the profile without zones (used while pairing); every
    device hands the library its own copy through ``brand_profile``, see
    :meth:`with_zones`.
    """

    drawn_zones: frozenset[str] = frozenset()
    """Keys of the zones with an outline; only these get zone capabilities."""

    DEVICE_CLASS = "sensor"

    VERSION = 2
    """Raise when the mapping changes; devices then refresh their capabilities once."""

    def with_zones(self, drawn_zones: Iterable[str]) -> SensyBrandProfile:
        """A copy that maps the zone entities of these zones."""
        zones = frozenset(drawn_zones)

        if zones == self.drawn_zones:
            return self

        return dataclasses.replace(self, drawn_zones=zones)

    def skip_entity(self, entity: EntityInfo) -> bool:
        object_id = entity.object_id

        if object_id in S1ProProfile.HIDDEN or object_id in _SETTING_ENTITIES:
            return True

        if object_id in _MAINTENANCE_ENTITIES:
            # Added as maintenance actions by after_map, not as tile buttons.
            return True

        zone_capability = _ZONE_ENTITIES.get(object_id)

        if zone_capability is not None:
            _capability, _kind, zone = zone_capability

            return zone.key not in self.drawn_zones

        if entity.entity_category == EntityCategory.NONE:
            return object_id not in S1ProProfile.CAPABILITIES

        return False

    def capability_id_for(self, entity: EntityInfo, default: str) -> str:
        zone_capability = _ZONE_ENTITIES.get(entity.object_id)

        if zone_capability is not None:
            capability, _kind, _zone = zone_capability

            return capability

        return BrandProfile.capability_id_for(self, entity, default)

    def device_class_for(
        self,
        homey_device: HomeyEspHomeDeviceOption,
        entity: EntityInfo | None,
    ) -> str | None:
        """Always a sensor, also when configuration switches or the LED are shown."""
        del homey_device, entity

        return self.DEVICE_CLASS

    def after_map(
        self,
        entities: Sequence[EntityInfo],
        homey_device: HomeyEspHomeDeviceOption,
    ) -> None:
        """Add maintenance actions, localise zone titles and drop orphaned ``esphome_*`` flow markers."""
        capabilities = homey_device["capabilities"]
        options = homey_device["capabilitiesOptions"]

        self._add_maintenance_buttons(entities, capabilities, options)
        self._localise_zone_titles(options)

        for capability in list(capabilities):
            if not self._is_orphan_marker(capability, capabilities, options):
                continue

            capabilities.remove(capability)
            options.pop(capability, None)

    @staticmethod
    def _add_maintenance_buttons(
        entities: Sequence[EntityInfo],
        capabilities: list[str],
        options: dict[str, dict[str, object]],
    ) -> None:
        keys: dict[str, int] = {}

        for entity in entities:
            keys[entity.object_id] = entity.key

        for button in MAINTENANCE_BUTTONS:
            key = keys.get(button.object_id)

            if key is None or button.capability in capabilities:
                continue

            capabilities.append(button.capability)
            options[button.capability] = button.options(key)

    @staticmethod
    def _localise_zone_titles(options: dict[str, dict[str, object]]) -> None:
        """The library titles a sub-capability with the entity name; use ours instead."""
        for capability, kind, zone in _ZONE_ENTITIES.values():
            if capability in options:
                options[capability]["title"] = kind.title(zone.number or 0)

    @staticmethod
    def _is_orphan_marker(
        capability: str,
        capabilities: list[str],
        options: dict[str, dict[str, object]],
    ) -> bool:
        """A bare ``esphome_*`` id that only exists for flow card filters, with no ``esphome_*.<id>`` left."""
        if not capability.startswith("esphome_") or "." in capability:
            return False

        if options.get(capability, {}).get("key") is not None:
            return False

        prefix = f"{capability}."
        has_sub_capability = any(other.startswith(prefix) for other in capabilities)

        return not has_sub_capability


def _remapped_capabilities() -> dict[str, str]:
    remapped: dict[str, str] = {}

    for object_id, capability in S1ProProfile.CAPABILITIES.items():
        if capability is not None:
            remapped[object_id] = capability

    return remapped


SENSY_BRAND_PROFILE = SensyBrandProfile(
    client_info=S1ProProfile.CLIENT_INFO,
    projects=frozenset({S1ProProfile.PROJECT_NAME}),
    device_entities=_remapped_capabilities(),
)
