"""Air quality classes of the BME688 (Bosch BSEC IAQ index)."""

from __future__ import annotations

from typing import ClassVar

from ..errors import ValidationError


class AirQuality:
    """One air quality class, ordered from best to worst.

    The firmware reports the class as text (``"Lightly polluted"``); that text
    is also the value of the ``sensy_air_quality`` capability and the id of the
    flow card dropdown, so it is the key here as well.

    Instances are flyweights: ``AirQuality.of("Good") is AirQuality.GOOD``.
    """

    EXCELLENT: ClassVar[AirQuality]
    GOOD: ClassVar[AirQuality]
    LIGHTLY_POLLUTED: ClassVar[AirQuality]
    MODERATELY_POLLUTED: ClassVar[AirQuality]
    HEAVILY_POLLUTED: ClassVar[AirQuality]
    SEVERELY_POLLUTED: ClassVar[AirQuality]
    EXTREMELY_POLLUTED: ClassVar[AirQuality]

    LEVELS: ClassVar[tuple[AirQuality, ...]]
    """Every class, from best to worst."""

    _registry: ClassVar[dict[str, AirQuality]] = {}

    __slots__ = ("key", "rank")

    key: str
    rank: int
    """0 for excellent, higher is worse."""

    def __init__(self, key: str, rank: int) -> None:
        self.key = key
        self.rank = rank
        AirQuality._registry[key] = self

    @classmethod
    def parse(cls, value: object) -> AirQuality | None:
        """Return the class the firmware reported, or ``None`` for anything else (``"error"``)."""
        return cls._registry.get(str(value))

    @classmethod
    def of(cls, value: object) -> AirQuality:
        """Like :meth:`parse`, for untrusted input such as flow card arguments.

        Raises:
            ValidationError: For unknown classes.
        """
        quality = cls.parse(value)

        if quality is None:
            raise ValidationError(f"Unknown air quality: {value}")

        return quality

    def at_least_as_bad_as(self, other: AirQuality) -> bool:
        return self.rank >= other.rank

    def __str__(self) -> str:
        return self.key

    def __repr__(self) -> str:
        return f"AirQuality({self.key!r})"


AirQuality.EXCELLENT = AirQuality("Excellent", 0)
AirQuality.GOOD = AirQuality("Good", 1)
AirQuality.LIGHTLY_POLLUTED = AirQuality("Lightly polluted", 2)
AirQuality.MODERATELY_POLLUTED = AirQuality("Moderately polluted", 3)
AirQuality.HEAVILY_POLLUTED = AirQuality("Heavily polluted", 4)
AirQuality.SEVERELY_POLLUTED = AirQuality("Severely polluted", 5)
AirQuality.EXTREMELY_POLLUTED = AirQuality("Extremely polluted", 6)
AirQuality.LEVELS = (
    AirQuality.EXCELLENT,
    AirQuality.GOOD,
    AirQuality.LIGHTLY_POLLUTED,
    AirQuality.MODERATELY_POLLUTED,
    AirQuality.HEAVILY_POLLUTED,
    AirQuality.SEVERELY_POLLUTED,
    AirQuality.EXTREMELY_POLLUTED,
)
