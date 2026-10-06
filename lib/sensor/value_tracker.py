"""Remembers values and reports how a new value relates to the previous one."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Change[T]:
    """How a new value relates to the previous value of the same key."""

    value: T
    previous: T | None
    initial: bool
    """True for the first value after a (re)connect."""

    changed: bool
    """True when a primed key received a different value."""


class ValueTracker:
    """Remembers the last value per key.

    The first value after :meth:`reset` is flagged ``initial``, so a reconnect
    never fires flows for values that merely got re-sent.
    """

    def __init__(self) -> None:
        self._values: dict[str, object] = {}
        self._primed: set[str] = set()

    def update[T](self, key: str, value: T) -> Change[T]:
        """Store a value and describe how it relates to the previous one."""
        previous: T | None = self._values.get(key)  # pyright: ignore[reportAssignmentType]
        initial = key not in self._primed

        self._values[key] = value
        self._primed.add(key)

        return Change(
            value=value,
            previous=previous,
            initial=initial,
            changed=not initial and previous != value,
        )

    def get[T](self, key: str, fallback: T) -> T:
        """Return the value of a key, or ``fallback`` when it has none."""
        value = self._values.get(key)

        if value is None:
            return fallback

        return value  # pyright: ignore[reportReturnType]

    def reset(self) -> None:
        """Forget which keys were seen, so the next value of each is ``initial``. Values are kept."""
        self._primed.clear()
