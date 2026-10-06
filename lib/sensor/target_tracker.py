"""Assembles per-axis position updates into complete target positions."""

from __future__ import annotations

from enum import StrEnum
from typing import ClassVar, Literal, Protocol

from ..utils import round_half_up

type Axis = Literal["x", "y"]

type TargetPosition = tuple[int, int] | None
"""A target in centimetres, or ``None`` for an empty slot."""


class TargetState(StrEnum):
    """What a target is doing, as reported by the official firmware's tracking."""

    MOVING = "moving"
    STATIONARY = "stationary"
    HELD = "held"
    """Stood still long enough to be held; stays even when the radar briefly loses it."""

    @classmethod
    def parse(cls, value: object) -> TargetState | None:
        """The state for the firmware's text, or ``None`` for "No target" and anything unknown."""
        return _FIRMWARE_STATES.get(str(value))


_FIRMWARE_STATES = {
    "Moving": TargetState.MOVING,
    "Stationary": TargetState.STATIONARY,
    "Holding": TargetState.HELD,
}


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
        self._states: list[TargetState | None] = self._empty_states()

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

    def update_state(self, slot: int, state: TargetState | None) -> bool:
        """Record what the target of a slot is doing; return whether it changed."""
        if slot < 0 or slot >= self.SLOTS:
            return False

        changed = self._states[slot] != state

        self._states[slot] = state

        return changed

    @property
    def positions(self) -> list[TargetPosition]:
        """A copy of the current positions."""
        return list(self._positions)

    @property
    def states(self) -> list[TargetState | None]:
        """What each target is doing; ``None`` for an empty slot or a firmware without states."""
        states: list[TargetState | None] = []

        for slot, state in enumerate(self._states):
            if self._positions[slot] is None:
                states.append(None)
            else:
                states.append(state)

        return states

    def reset(self) -> None:
        self._axes = self._empty_axes()
        self._positions = self._empty_positions()
        self._states = self._empty_states()

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

    @classmethod
    def _empty_states(cls) -> list[TargetState | None]:
        return [None] * cls.SLOTS
