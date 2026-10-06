"""Shared helpers: logging and number handling."""

from __future__ import annotations

import math
from collections.abc import Callable
from typing import Protocol


class Logger(Protocol):
    """The logging methods of a Homey App, Driver or Device."""

    def log(self, *args: object) -> None: ...

    def error(self, *args: object) -> None: ...


class SilentLogger:
    """Logger that discards everything; the default for components under test."""

    def log(self, *args: object) -> None:
        del args

    def error(self, *args: object) -> None:
        del args


def clamp(value: float, minimum: float, maximum: float) -> float:
    """Clamp a number into the inclusive range [minimum, maximum]."""
    return min(maximum, max(minimum, value))


def to_finite_number(value: object, fallback: float) -> float:
    """Parse a finite number, falling back when the input is not numeric."""
    if isinstance(value, bool):
        return float(value)

    if not isinstance(value, (int, float, str)):
        return fallback

    try:
        number = float(value)
    except ValueError:
        return fallback

    if not math.isfinite(number):
        return fallback

    return number


def round_to(decimals: int) -> Callable[[object], float]:
    """Create a converter that rounds to a fixed number of decimals."""

    factor = 10**decimals

    def convert(value: object) -> float:
        number = to_finite_number(value, 0.0)

        return round_half_up(number * factor) / factor

    return convert


def round_half_up(value: float) -> int:
    """Round halves up (like JavaScript's ``Math.round``), not to even."""
    return math.floor(value + 0.5)
