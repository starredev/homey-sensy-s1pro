"""Fire-and-forget coroutines that never fail silently."""

from __future__ import annotations

import asyncio
from collections.abc import Coroutine
from typing import Any

from lib.utils import Logger


class TaskRunner:
    """Runs coroutines from synchronous callbacks and logs their failures.

    Sensor notifications are synchronous; Homey I/O is async. A rejected task
    must be logged, never left as an unretrieved exception.
    """

    def __init__(self, logger: Logger) -> None:
        self._logger = logger
        self._tasks: set[asyncio.Task[Any]] = set()

    def run(self, coroutine: Coroutine[Any, Any, Any]) -> None:
        task = asyncio.ensure_future(coroutine)

        # Keep a reference until done, or the task can be garbage collected mid-flight.
        self._tasks.add(task)
        task.add_done_callback(self._on_done)

    async def drain(self) -> None:
        """Wait for every running task; used by tests."""
        while self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)

    def _on_done(self, task: asyncio.Task[Any]) -> None:
        self._tasks.discard(task)

        if task.cancelled():
            return

        error = task.exception()

        if error is not None:
            self._logger.error(error)
