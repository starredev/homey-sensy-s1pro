"""Per-zone sub-capabilities, only for zones the user drew."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass

from ..sensor.polygon import Polygon
from ..sensor.zone import Zone


@dataclass(frozen=True, slots=True)
class ZoneCapabilityKind:
    """One kind of per-zone sub-capability, e.g. ``sensy_zone_presence.zone2``."""

    base: str
    """Capability id without the ``.zoneN`` suffix."""

    entity_suffix: str
    """The zone entity that feeds it, e.g. ``presence`` for ``zone_2_presence``."""

    title: Callable[[int], dict[str, str]]
    """Localised title per zone number."""

    def id_for(self, zone: Zone) -> str:
        return f"{self.base}.zone{zone.number}"


def _presence_title(number: int) -> dict[str, str]:
    return {"en": f"Zone {number} presence", "nl": f"Aanwezigheid zone {number}"}


def _movement_title(number: int) -> dict[str, str]:
    return {"en": f"Zone {number} movement", "nl": f"Beweging zone {number}"}


def _people_title(number: int) -> dict[str, str]:
    return {"en": f"People in zone {number}", "nl": f"Personen in zone {number}"}


KINDS = (
    ZoneCapabilityKind("sensy_zone_presence", "presence", _presence_title),
    ZoneCapabilityKind("sensy_zone_movement", "movement", _movement_title),
    ZoneCapabilityKind("sensy_zone_people", "target_count", _people_title),
)


class ZoneCapabilities:
    """Which zone capabilities a device should have.

    The firmware always reports the presence, movement and people count of all
    three zones, also of zones without an outline. Whether a zone is drawn is
    only known from the *value* of its ``points_count``, which the entity
    mapping of ``homey-esphomedriver`` never sees. So the device remembers the
    drawn zones and hands them to its brand profile, which then maps the zone
    entities of exactly those zones onto these capabilities.
    """

    PREFIX = "sensy_zone_"

    @staticmethod
    def entity_capabilities() -> dict[str, tuple[str, ZoneCapabilityKind, Zone]]:
        """ESPHome object id -> (capability id, kind, zone), for every detection zone."""
        mapping: dict[str, tuple[str, ZoneCapabilityKind, Zone]] = {}

        for zone in Zone.DETECTION:
            for kind in KINDS:
                mapping[zone.entity(kind.entity_suffix)] = (kind.id_for(zone), kind, zone)

        return mapping

    @staticmethod
    def drawn(outline_of: Callable[[Zone], Polygon | None]) -> frozenset[str] | None:
        """Keys of the zones with an outline, or ``None`` while an outline is still incomplete."""
        keys: set[str] = set()

        for zone in Zone.DETECTION:
            outline = outline_of(zone)

            if outline is None:
                return None

            if not outline.is_empty:
                keys.add(zone.key)

        return frozenset(keys)

    @staticmethod
    def expected(drawn_zones: Iterable[str]) -> frozenset[str]:
        """The zone capability ids a device with these drawn zones should have."""
        drawn = set(drawn_zones)
        capabilities: set[str] = set()

        for zone in Zone.DETECTION:
            if zone.key not in drawn:
                continue

            for kind in KINDS:
                capabilities.add(kind.id_for(zone))

        return frozenset(capabilities)

    @staticmethod
    def canonical() -> frozenset[str]:
        """Every zone capability id this app uses, for all detection zones."""
        return ZoneCapabilities.expected(zone.key for zone in Zone.DETECTION)

    @classmethod
    def present(cls, capabilities: Iterable[str]) -> frozenset[str]:
        """The zone capability ids among a device's capabilities."""
        present: set[str] = set()

        for capability in capabilities:
            if capability.startswith(cls.PREFIX):
                present.add(capability)

        return frozenset(present)
