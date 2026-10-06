"""Detection areas of the S1 Pro."""

from __future__ import annotations

from typing import ClassVar

from lib.errors import ValidationError


class Zone:
    """A detection area of the S1 Pro.

    Zones 1-3 report presence and movement; the exclusion zone masks out an
    area (a fan, a curtain) and reports nothing.

    Instances are flyweights: ``Zone.of("2") is Zone.of(2)``.
    """

    ONE: ClassVar[Zone]
    TWO: ClassVar[Zone]
    THREE: ClassVar[Zone]
    EXCLUSION: ClassVar[Zone]

    DETECTION: ClassVar[tuple[Zone, ...]]
    """Zones that detect presence, in display order."""

    ALL: ClassVar[tuple[Zone, ...]]
    """Every zone, including the exclusion zone."""

    _registry: ClassVar[dict[str, Zone]] = {}

    __slots__ = ("key", "number")

    key: str
    number: int | None

    def __init__(self, key: str, number: int | None) -> None:
        self.key = key
        self.number = number
        Zone._registry[key] = self

    @classmethod
    def of(cls, value: object) -> Zone:
        """Return the zone for a key such as ``1``, ``"2"`` or ``"exclusion"``.

        Raises:
            ValidationError: For unknown zones.
        """
        zone = cls._registry.get(str(value))

        if zone is None:
            raise ValidationError(f"Unknown zone: {value}")

        return zone

    @classmethod
    def detection(cls, value: object) -> Zone:
        """Like :meth:`of`, but only accepts zones that detect presence.

        Raises:
            ValidationError: For unknown zones and the exclusion zone.
        """
        zone = cls.of(value)

        if zone.is_exclusion:
            raise ValidationError("The exclusion zone has no presence settings")

        return zone

    @property
    def is_exclusion(self) -> bool:
        return self.number is None

    @property
    def entity_prefix(self) -> str:
        """Prefix of this zone's ESPHome object ids: ``zone_1`` or ``exclusion_zone``."""
        if self.number is None:
            return "exclusion_zone"

        return f"zone_{self.number}"

    def entity(self, suffix: str) -> str:
        """Return the ESPHome object id of an entity, e.g. ``zone_1_presence``."""
        return f"{self.entity_prefix}_{suffix}"

    def __str__(self) -> str:
        return self.key

    def __repr__(self) -> str:
        return f"Zone({self.key!r})"


Zone.ONE = Zone("1", 1)
Zone.TWO = Zone("2", 2)
Zone.THREE = Zone("3", 3)
Zone.EXCLUSION = Zone("exclusion", None)
Zone.DETECTION = (Zone.ONE, Zone.TWO, Zone.THREE)
Zone.ALL = (*Zone.DETECTION, Zone.EXCLUSION)
