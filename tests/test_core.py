"""Shared building blocks: utils, timers, errors and the task runner."""

from __future__ import annotations

import asyncio

from lib.errors import NotConnectedError, NotFoundError, SensyError, ValidationError
from lib.homey.tasks import TaskRunner
from lib.timers import Debouncer, KeyedThrottle
from lib.utils import SilentLogger, clamp, round_half_up, round_to, to_finite_number
from tests.fakes import FakeTimers, RecordingLogger


class TestUtils:
    def test_clamp(self) -> None:
        assert clamp(5, 0, 10) == 5
        assert clamp(-1, 0, 10) == 0
        assert clamp(11, 0, 10) == 10

    def test_to_finite_number(self) -> None:
        assert to_finite_number("12.5", 0) == 12.5
        assert to_finite_number(3, 0) == 3
        assert to_finite_number(True, 0) == 1
        assert to_finite_number("abc", 7) == 7
        assert to_finite_number(None, 7) == 7
        assert to_finite_number(float("nan"), 7) == 7
        assert to_finite_number(float("inf"), 7) == 7

    def test_round_half_up_like_javascript(self) -> None:
        assert round_half_up(2.5) == 3
        assert round_half_up(-2.5) == -2
        assert round_to(1)(21.25) == 21.3
        assert round_to(0)("abc") == 0

    def test_silent_logger_discards(self) -> None:
        logger = SilentLogger()

        logger.log("ignored")
        logger.error("ignored")


class TestErrors:
    def test_codes(self) -> None:
        assert SensyError("x").code == "SENSY_ERROR"
        assert ValidationError("x").code == "VALIDATION"
        assert NotFoundError("x").code == "NOT_FOUND"
        assert NotConnectedError().code == "NOT_CONNECTED"

    def test_not_connected_message(self) -> None:
        assert str(NotConnectedError()) == "Sensor not connected"
        assert str(NotConnectedError("zone_1_p1_x")) == "Sensor not connected (zone_1_p1_x)"


class TestDebouncer:
    def test_runs_once_after_quiet_period(self) -> None:
        timers = FakeTimers()
        runs: list[int] = []
        debouncer = Debouncer(timers, 100, lambda: runs.append(timers.now))

        debouncer.schedule()
        timers.tick(50)
        debouncer.schedule()
        assert debouncer.pending

        timers.tick(99)
        assert runs == []

        timers.tick(1)
        assert runs == [150]
        assert not debouncer.pending

    def test_cancel(self) -> None:
        timers = FakeTimers()
        runs: list[int] = []
        debouncer = Debouncer(timers, 100, lambda: runs.append(1))

        debouncer.cancel()
        debouncer.schedule()
        debouncer.cancel()
        timers.tick(200)

        assert runs == []
        assert timers.pending == 0


class TestKeyedThrottle:
    def test_flushes_latest_item_per_key(self) -> None:
        timers = FakeTimers()
        flushed: list[list[str]] = []
        throttle = KeyedThrottle[str](timers, 200, flushed.append)

        throttle.push("a", "a1")
        throttle.push("a", "a2")
        throttle.push("b", "b1")
        timers.tick(200)

        assert flushed == [["a2", "b1"]]

        timers.tick(200)
        assert flushed == [["a2", "b1"]]

    def test_cancel_drops_queue(self) -> None:
        timers = FakeTimers()
        flushed: list[list[str]] = []
        throttle = KeyedThrottle[str](timers, 200, flushed.append)

        throttle.push("a", "a1")
        throttle.cancel()
        timers.tick(400)

        assert flushed == []


class TestTaskRunner:
    async def test_logs_failures(self) -> None:
        logger = RecordingLogger()
        runner = TaskRunner(logger)

        async def fail() -> None:
            raise RuntimeError("boom")

        async def succeed() -> None:
            await asyncio.sleep(0)

        runner.run(fail())
        runner.run(succeed())
        await runner.drain()

        assert len(logger.errors) == 1
        assert str(logger.errors[0][0]) == "boom"

    async def test_ignores_cancelled_tasks(self) -> None:
        logger = RecordingLogger()
        runner = TaskRunner(logger)

        async def forever() -> None:
            await asyncio.Event().wait()

        runner.run(forever())

        for task in list(runner._tasks):
            task.cancel()

        await runner.drain()

        assert logger.errors == []
