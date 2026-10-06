"""Zone outlines."""

from __future__ import annotations

import math
from collections.abc import Sequence
from typing import ClassVar, cast

from ..errors import ValidationError
from ..utils import clamp, round_half_up

type Point = tuple[int, int]
"""A vertex in centimetres: x = left (-) / right (+), y = distance in front of the sensor."""


class Polygon:
    """Immutable zone outline.

    Either empty (zone disabled) or 3-8 vertices in whole centimetres,
    clamped to the radar's coordinate range.
    """

    MIN_POINTS: ClassVar[int] = 3
    MAX_POINTS: ClassVar[int] = 8
    COORDINATE_LIMIT: ClassVar[int] = 1800

    EMPTY: ClassVar[Polygon]

    __slots__ = ("_points",)

    _points: tuple[Point, ...]

    def __init__(self, points: Sequence[Point]) -> None:
        """Create a polygon from validated points; use :meth:`parse` for untrusted input."""
        self._points = tuple(points)

    @classmethod
    def parse(cls, value: object) -> Polygon:
        """Validate and normalise untrusted input (API bodies, flow arguments).

        Raises:
            ValidationError: When the input is not a list of 0 or 3-8 points.
        """
        if not isinstance(value, (list, tuple)):
            raise ValidationError("Points must be a list")

        items = cast("Sequence[object]", value)

        if len(items) == 0:
            return cls.EMPTY

        if len(items) < cls.MIN_POINTS or len(items) > cls.MAX_POINTS:
            raise ValidationError(f"A zone needs {cls.MIN_POINTS} to {cls.MAX_POINTS} points")

        points: list[Point] = []

        for item in items:
            points.append(cls._normalise(item))

        return cls(points)

    @classmethod
    def _normalise(cls, point: object) -> Point:
        if not isinstance(point, (list, tuple)):
            raise ValidationError("Invalid point")

        coordinates = cast("Sequence[object]", point)

        if len(coordinates) < 2:
            raise ValidationError("Invalid point")

        x = cls._coordinate(coordinates[0])
        y = cls._coordinate(coordinates[1])

        return (x, y)

    @classmethod
    def _coordinate(cls, value: object) -> int:
        if isinstance(value, bool) or not isinstance(value, (int, float, str)):
            raise ValidationError("Invalid point")

        try:
            number = float(value)
        except ValueError as error:
            raise ValidationError("Invalid point") from error

        if not math.isfinite(number):
            raise ValidationError("Invalid point")

        limit = cls.COORDINATE_LIMIT

        return int(clamp(round_half_up(number), -limit, limit))

    @property
    def points(self) -> tuple[Point, ...]:
        return self._points

    @property
    def size(self) -> int:
        return len(self._points)

    @property
    def is_empty(self) -> bool:
        return len(self._points) == 0

    def to_json(self) -> list[list[int]]:
        """Plain JSON for the API."""
        return [[x, y] for x, y in self._points]

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Polygon):
            return NotImplemented

        return self._points == other._points

    def __hash__(self) -> int:
        return hash(self._points)

    def __repr__(self) -> str:
        return f"Polygon({list(self._points)!r})"


Polygon.EMPTY = Polygon(())
