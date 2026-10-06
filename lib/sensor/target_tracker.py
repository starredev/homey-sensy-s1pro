"""Assembles per-axis position updates into complete target positions."""

from __future__ import annotations

from typing import ClassVar, Literal, Protocol

from ..utils import round_half_up

type Axis = Literal["x", "y"]

type TargetPosition = tuple[int, int] | None
"""A target in centimetres, or ``None`` for an empty slot."""


class PositionSource(Protocol):
    """How a firmware reports positions; see ``TargetFeed`` in ``bindings``."""

    def is_empty(self, x: float, y: float) -> bool:
        """Whether a position means "no target"."""
        ...

    def completes(self, axis: Axis) -> bool:
        """Whether an update of this axis completes a position."""
        ...


class TargetTracker:
    """Tracks the radar's three target slots.

    How positions are reported depends on the firmware, so the caller passes
    its :class:`PositionSource` with every update.
    """

    SLOTS: ClassVar[int] = 3

    def __init__(self) -> None:
        self._axes: list[dict[Axis, float]] = self._empty_axes()
        self._positions: list[TargetPosition] = self._empty_positions()

    def update(self, slot: int, axis: Axis, value: float, source: PositionSource) -> bool:
        """Record one axis of a slot.

        Args:
            slot: 0-based target slot.
            axis: ``x`` or ``y``.
            value: Centimetres.
            source: The feed that reported the value.

        Returns:
            Whether the position of the slot changed.
        """
        if slot < 0 or slot >= self.SLOTS:
            return False

        axes = self._axes[slot]
        axes[axis] = float(value)

        x = axes.get("x")
        y = axes.get("y")

        if x is None or y is None or not source.completes(axis):
            return False

        position = self._to_position(x, y, source)
        changed = self._positions[slot] != position

        self._positions[slot] = position

        return changed

    @property
    def positions(self) -> list[TargetPosition]:
        """A copy of the current positions."""
        return list(self._positions)

    def reset(self) -> None:
        self._axes = self._empty_axes()
        self._positions = self._empty_positions()

    @staticmethod
    def _to_position(x: float, y: float, source: PositionSource) -> TargetPosition:
        if source.is_empty(x, y):
            return None

        return (round_half_up(x), round_half_up(y))

    @classmethod
    def _empty_axes(cls) -> list[dict[Axis, float]]:
        return [{} for _ in range(cls.SLOTS)]

    @classmethod
    def _empty_positions(cls) -> list[TargetPosition]:
        return [None] * cls.SLOTS
