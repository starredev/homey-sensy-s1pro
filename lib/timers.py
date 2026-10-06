"""Timer helpers built on a minimal, injectable timer port.

Homey wants apps to use ``homey.set_timeout`` so timers are cleared when the
app stops; tests inject a fake clock.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Protocol


class Timers(Protocol):
    """The subset of ``homey`` used for timers."""

    def set_timeout(self, callback: Callable[[], None], ms: int) -> int: ...

    def clear_timeout(self, id: int | None) -> None: ...


class Debouncer:
    """Collapses bursts of calls into one trailing invocation."""

    def __init__(self, timers: Timers, delay_ms: int, task: Callable[[], None]) -> None:
        """
        Args:
            timers: Timer port.
            delay_ms: Milliseconds of quiet before the task runs.
            task: Runs once the quiet period ends.
        """
        self._timers = timers
        self._delay_ms = delay_ms
        self._task = task
        self._handle: int | None = None

    @property
    def pending(self) -> bool:
        """Whether the task is scheduled."""
        return self._handle is not None

    def schedule(self) -> None:
        """Restart the quiet period."""
        self.cancel()
        self._handle = self._timers.set_timeout(self._run, self._delay_ms)

    def cancel(self) -> None:
        """Drop a scheduled run."""
        if self._handle is None:
            return

        self._timers.clear_timeout(self._handle)
        self._handle = None

    def _run(self) -> None:
        self._handle = None
        self._task()


class KeyedThrottle[T]:
    """Flushes the latest item per key at most once per interval.

    Used to rate-limit realtime pushes of fast-moving radar data.
    """

    def __init__(
        self,
        timers: Timers,
        interval_ms: int,
        flush: Callable[[list[T]], None],
    ) -> None:
        """
        Args:
            timers: Timer port.
            interval_ms: Milliseconds between flushes.
            flush: Receives the latest item of every key that was pushed.
        """
        self._timers = timers
        self._interval_ms = interval_ms
        self._flush = flush
        self._queue: dict[str, T] = {}
        self._handle: int | None = None

    def push(self, key: str, item: T) -> None:
        """Queue an item; it replaces an earlier item with the same key."""
        self._queue[key] = item

        if self._handle is not None:
            return

        self._handle = self._timers.set_timeout(self._drain, self._interval_ms)

    def cancel(self) -> None:
        """Drop the queue and a scheduled flush."""
        if self._handle is not None:
            self._timers.clear_timeout(self._handle)

        self._handle = None
        self._queue.clear()

    def _drain(self) -> None:
        items = list(self._queue.values())

        self._handle = None
        self._queue.clear()

        if items:
            self._flush(items)
