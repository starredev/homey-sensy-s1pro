"""Publishes sensor state to the web views over Homey's realtime API."""

from __future__ import annotations

from typing import Any, ClassVar, Protocol

from lib.homey.presenter import SensorPresenter, SensorView
from lib.homey.tasks import TaskRunner
from lib.timers import KeyedThrottle, Timers
from lib.utils import Logger


class RealtimeApi(Protocol):
    """The subset of ``homey.api`` used here."""

    async def realtime(self, event: str, data: Any) -> None: ...


class Channels:
    """Realtime channels the widget and the zone editor subscribe to."""

    LIVE = "sensy.live"
    ZONES = "sensy.zones"
    DEVICES = "sensy.devices"


class RealtimeHub:
    """Publishes live frames, zone snapshots and the sensor list.

    Live radar data is throttled per sensor, because the radar reports target
    positions far faster than a dashboard needs to redraw.
    """

    LIVE_INTERVAL_MS: ClassVar[int] = 200
    """Minimum time between two live frames of the same sensor."""

    def __init__(self, *, api: RealtimeApi, timers: Timers, logger: Logger) -> None:
        self._api = api
        self._logger = logger
        self._tasks = TaskRunner(logger)
        self._live_frames = KeyedThrottle[SensorView](timers, self.LIVE_INTERVAL_MS, self._flush_live)

    def live(self, view: SensorView) -> None:
        """Queue a live frame (targets, presence) of a sensor."""
        self._live_frames.push(view.id, view)

    def zones(self, view: SensorView) -> None:
        """Publish a full snapshot after the zones of a sensor changed."""
        self._publish(Channels.ZONES, SensorPresenter.snapshot(view))

    def devices(self, views: list[SensorView]) -> None:
        """Publish the list of sensors and their connection status."""
        summaries: list[dict[str, Any]] = []

        for view in views:
            summaries.append(SensorPresenter.summary(view))

        self._publish(Channels.DEVICES, summaries)

    def dispose(self) -> None:
        self._live_frames.cancel()

    async def drain(self) -> None:
        """Wait for pending publications; used by tests."""
        await self._tasks.drain()

    def _flush_live(self, views: list[SensorView]) -> None:
        for view in views:
            self._publish(Channels.LIVE, SensorPresenter.live(view))

    def _publish(self, channel: str, data: Any) -> None:
        self._tasks.run(self._send(channel, data))

    async def _send(self, channel: str, data: Any) -> None:
        # Fire-and-forget: a web view that is not open is not an error.
        try:
            await self._api.realtime(channel, data)
        except Exception as error:  # noqa: BLE001 - only logged
            self._logger.error(f"Realtime {channel} failed:", error)
