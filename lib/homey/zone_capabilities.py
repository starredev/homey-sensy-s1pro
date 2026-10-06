"""Per-zone sub-capabilities, only for zones the user drew."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from ..homey.capability_store import CapabilityStore
from ..sensor.polygon import Polygon
from ..sensor.sensor import ZoneStatus
from ..sensor.zone import Zone


@dataclass(frozen=True, slots=True)
class ZoneCapabilityKind:
    """One kind of per-zone sub-capability, e.g. ``sensy_zone_presence.zone2``."""

    base: str
    """Capability id without the ``.zoneN`` suffix."""

    title: Callable[[int], dict[str, str]]
    """Localised title per zone number."""

    value: Callable[[ZoneStatus], bool | int]
    """Picks the status field that feeds the capability."""

    def id_for(self, zone: Zone) -> str:
        return f"{self.base}.zone{zone.number}"

    def options_for(self, zone: Zone) -> dict[str, Any]:
        return {"title": self.title(zone.number or 0)}


def _presence_title(number: int) -> dict[str, str]:
    return {"en": f"Zone {number} presence", "nl": f"Aanwezigheid zone {number}"}


def _movement_title(number: int) -> dict[str, str]:
    return {"en": f"Zone {number} movement", "nl": f"Beweging zone {number}"}


def _people_title(number: int) -> dict[str, str]:
    return {"en": f"People in zone {number}", "nl": f"Personen in zone {number}"}


def _presence(status: ZoneStatus) -> bool:
    return status.presence


def _movement(status: ZoneStatus) -> bool:
    return status.movement


def _people(status: ZoneStatus) -> int:
    return status.people


KINDS = (
    ZoneCapabilityKind("sensy_zone_presence", _presence_title, _presence),
    ZoneCapabilityKind("sensy_zone_movement", _movement_title, _movement),
    ZoneCapabilityKind("sensy_zone_people", _people_title, _people),
)


class ZoneCapabilities:
    """Keeps the per-zone sub-capabilities in line with the zones that have an outline.

    The device tile then only shows zones the user drew.
    """

    def __init__(self, store: CapabilityStore) -> None:
        self._store = store

    async def reconcile(
        self,
        outline_of: Callable[[Zone], Polygon | None],
        status_of: Callable[[Zone], ZoneStatus],
    ) -> None:
        """Add or remove capabilities per zone.

        Zones whose outline is not fully known yet (``None``) are left alone.
        """
        for zone in Zone.DETECTION:
            outline = outline_of(zone)

            if outline is None:
                continue

            if outline.is_empty:
                await self._remove_all(zone)
            else:
                await self._add_all(zone)
                await self.update(zone, status_of(zone))

    async def update(self, zone: Zone, status: ZoneStatus) -> None:
        for kind in KINDS:
            await self._store.set(kind.id_for(zone), kind.value(status))

    async def _add_all(self, zone: Zone) -> None:
        for kind in KINDS:
            await self._store.add(kind.id_for(zone), kind.options_for(zone))

    async def _remove_all(self, zone: Zone) -> None:
        for kind in KINDS:
            await self._store.remove(kind.id_for(zone))
