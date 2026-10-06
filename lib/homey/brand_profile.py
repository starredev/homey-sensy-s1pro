"""The ``homey-esphomedriver`` brand profile of the S1 Pro."""

from __future__ import annotations

from collections.abc import Sequence

from aioesphomeapi import EntityCategory, EntityInfo
from homey_esphomedriver.esphome_types import HomeyEspHomeDeviceOption
from homey_esphomedriver.profile import BrandProfile

from ..sensor.profile import S1ProProfile


def _setting_entities() -> frozenset[str]:
    """Entities that are already device settings; never also a capability."""
    object_ids: set[str] = set()

    for binding in S1ProProfile.SETTINGS:
        object_ids.add(binding.object_id)

    return frozenset(object_ids)


_SETTING_ENTITIES = _setting_entities()


class SensyBrandProfile(BrandProfile):
    """Tells ``homey-esphomedriver`` which S1 Pro entities become capabilities.

    The sensor reports about 150 entities; most of them (zone geometry, target
    feeds, tuning numbers) have no entity category, so the generic mapping
    would put them all on the device tile. Here, entities without a category
    are only mapped when :attr:`S1ProProfile.CAPABILITIES` lists them; the app
    handles zones, targets and settings itself. Diagnostic and configuration
    entities keep the library behaviour: hidden until the user enables them in
    the device settings.
    """

    __slots__ = ()

    DEVICE_CLASS = "sensor"

    def skip_entity(self, entity: EntityInfo) -> bool:
        object_id = entity.object_id

        if object_id in S1ProProfile.HIDDEN or object_id in _SETTING_ENTITIES:
            return True

        if entity.entity_category == EntityCategory.NONE:
            return object_id not in S1ProProfile.CAPABILITIES

        return False

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
        """Drop ``esphome_*`` flow markers left without sub-capabilities by a remap."""
        del entities
        capabilities = homey_device["capabilities"]
        options = homey_device["capabilitiesOptions"]

        for capability in list(capabilities):
            if not self._is_orphan_marker(capability, capabilities, options):
                continue

            capabilities.remove(capability)
            options.pop(capability, None)

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
