"""Test doubles for the ports and Homey objects the app talks to."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any

from lib.errors import NotConnectedError
from lib.homey.presenter import SensorView
from lib.sensor.events import SensorEvent
from lib.sensor.polygon import Polygon
from lib.sensor.ports import EntityListener, EntityValue
from lib.sensor.sensor import S1ProSensor, ZoneStatus
from lib.sensor.zone import Zone


def build[T](kind: type[T], **fields: Any) -> T:
    """Create an ``aioesphomeapi`` model; its compiled dataclasses hide their fields from type checkers."""
    return kind(**fields)


class FakeTimers:
    """A manual clock: timers only fire on :meth:`tick`."""

    def __init__(self) -> None:
        self.now = 0
        self._next_id = 0
        self._pending: dict[int, tuple[int, Callable[[], None]]] = {}

    def set_timeout(self, callback: Callable[[], None], ms: int) -> int:
        self._next_id += 1
        self._pending[self._next_id] = (self.now + ms, callback)

        return self._next_id

    def clear_timeout(self, id: int | None) -> None:
        if id is not None:
            self._pending.pop(id, None)

    @property
    def pending(self) -> int:
        return len(self._pending)

    def tick(self, ms: int) -> None:
        """Advance the clock and run every timer that is due, in order."""
        self.now += ms

        while True:
            due = [(when, handle) for handle, (when, _) in self._pending.items() if when <= self.now]

            if not due:
                return

            _, handle = min(due)
            _, callback = self._pending.pop(handle)
            callback()


class FakePort:
    """An in-memory entity port that records commands."""

    def __init__(self) -> None:
        self.connected = True
        self.values: dict[str, EntityValue] = {}
        self.commands: list[tuple[str, str, float | bool]] = []
        self.listener: EntityListener | None = None

    def listen(self, listener: EntityListener) -> None:
        self.listener = listener

    def get(self, object_id: str) -> EntityValue | None:
        return self.values.get(object_id)

    def set_number(self, object_id: str, value: float) -> None:
        self._command("number", object_id, value)

    def set_switch(self, object_id: str, on: bool) -> None:
        self._command("switch", object_id, on)

    def report(self, object_id: str, value: EntityValue) -> None:
        """Simulate a state the sensor reported."""
        self.values[object_id] = value

        if self.listener is not None:
            self.listener.on_entity_state(object_id, value)

    def report_zone(self, zone: Zone, points: list[tuple[int, int]]) -> None:
        self.report(zone.entity("points_count"), len(points))

        for index, (x, y) in enumerate(points, start=1):
            self.report(zone.entity(f"p{index}_x"), x)
            self.report(zone.entity(f"p{index}_y"), y)

    def connect(self) -> None:
        self.connected = True

        if self.listener is not None:
            self.listener.on_entities_connected()

    def disconnect(self) -> None:
        self.connected = False

        if self.listener is not None:
            self.listener.on_entities_disconnected()

    def _command(self, kind: str, object_id: str, value: float | bool) -> None:
        if not self.connected:
            raise NotConnectedError(object_id)

        self.commands.append((kind, object_id, value))
        self.values[object_id] = value


@dataclass
class RecordingObserver:
    """Records every notification of the sensor model."""

    calls: list[str] = field(default_factory=list[str])
    events: list[SensorEvent] = field(default_factory=list[SensorEvent])
    zone_statuses: list[tuple[Zone, ZoneStatus]] = field(default_factory=list[tuple[Zone, ZoneStatus]])
    proxy: list[bool] = field(default_factory=list[bool])

    def on_sensor_connected(self) -> None:
        self.calls.append("connected")

    def on_sensor_disconnected(self) -> None:
        self.calls.append("disconnected")

    def on_zone_status(self, zone: Zone, status: ZoneStatus) -> None:
        self.zone_statuses.append((zone, status))

    def on_sensor_event(self, event: SensorEvent) -> None:
        self.events.append(event)

    def on_live(self) -> None:
        self.calls.append("live")

    def on_zones_changed(self) -> None:
        self.calls.append("zones")

    def on_settings_changed(self) -> None:
        self.calls.append("settings")

    def on_bluetooth_proxy(self, enabled: bool) -> None:
        self.proxy.append(enabled)

    def count(self, name: str) -> int:
        return self.calls.count(name)


@dataclass
class SensorRig:
    """A sensor model wired to fakes."""

    port: FakePort
    timers: FakeTimers
    observer: RecordingObserver
    sensor: S1ProSensor
    sleeps: list[float]


def make_sensor() -> SensorRig:
    port = FakePort()
    timers = FakeTimers()
    observer = RecordingObserver()
    sleeps: list[float] = []

    async def sleep(seconds: float) -> None:
        sleeps.append(seconds)

    sensor = S1ProSensor(port=port, timers=timers, observer=observer, sleep=sleep)

    return SensorRig(port=port, timers=timers, observer=observer, sensor=sensor, sleeps=sleeps)


def square() -> list[tuple[int, int]]:
    return [(-100, 100), (100, 100), (100, 300), (-100, 300)]


def square_polygon() -> Polygon:
    return Polygon.parse([list(point) for point in square()])


class RecordingLogger:
    def __init__(self) -> None:
        self.logs: list[tuple[object, ...]] = []
        self.errors: list[tuple[object, ...]] = []

    def log(self, *args: object) -> None:
        self.logs.append(args)

    def error(self, *args: object) -> None:
        self.errors.append(args)


class FakeCapabilityHost:
    """The capability and settings surface of a Homey device."""

    def __init__(self, capabilities: Mapping[str, Any] | None = None) -> None:
        self.values: dict[str, Any] = dict(capabilities or {})
        self.options: dict[str, dict[str, Any]] = {}
        self.settings: dict[str, Any] = {}
        self.writes: list[tuple[str, Any]] = []
        self.fail_writes = False

    def has_capability(self, id: str) -> bool:
        return id in self.values

    def get_capability_value(self, id: str) -> Any:
        return self.values.get(id)

    async def set_capability_value(self, id: str, value: Any) -> None:
        if self.fail_writes:
            raise RuntimeError("write failed")

        self.writes.append((id, value))
        self.values[id] = value

    async def add_capability(self, id: str) -> None:
        self.values[id] = None

    async def remove_capability(self, id: str) -> None:
        self.values.pop(id, None)
        self.options.pop(id, None)

    async def set_capability_options(self, id: str, options: dict[str, Any]) -> None:
        self.options[id] = options

    def get_settings(self) -> Mapping[str, Any]:
        return self.settings

    async def set_settings(self, settings: dict[str, Any]) -> None:
        self.settings.update(settings)


class FakeCard:
    """A flow card that records registrations and triggers."""

    def __init__(self, card_id: str) -> None:
        self.id = card_id
        self.listener: Callable[..., Any] | None = None
        self.triggers: list[tuple[Any, dict[str, Any], dict[str, Any]]] = []
        self.fail = False

    def register_run_listener(self, listener: Callable[..., Any]) -> FakeCard:
        self.listener = listener

        return self

    async def trigger(self, device: Any, tokens: dict[str, Any], **trigger_kwargs: Any) -> None:
        if self.fail:
            raise RuntimeError("trigger failed")

        self.triggers.append((device, tokens, trigger_kwargs))

    async def run(self, card_arguments: Mapping[str, Any], **trigger_kwargs: Any) -> Any:
        assert self.listener is not None

        return await self.listener(card_arguments, **trigger_kwargs)


class FakeFlow:
    def __init__(self) -> None:
        self.cards: dict[str, FakeCard] = {}

    def get_device_trigger_card(self, id: str) -> FakeCard:
        return self._card(id)

    def get_condition_card(self, id: str) -> FakeCard:
        return self._card(id)

    def get_action_card(self, id: str) -> FakeCard:
        return self._card(id)

    def _card(self, card_id: str) -> FakeCard:
        if card_id not in self.cards:
            self.cards[card_id] = FakeCard(card_id)

        return self.cards[card_id]


@dataclass
class FlowTestDevice:
    sensor: S1ProSensor


class FakeRealtimeApi:
    def __init__(self) -> None:
        self.published: list[tuple[str, Any]] = []
        self.fail = False

    async def realtime(self, event: str, data: Any) -> None:
        if self.fail:
            raise RuntimeError("realtime failed")

        self.published.append((event, data))


def make_view(sensor: S1ProSensor, device_id: str = "48f6ee2cd9f0", name: str = "Living room") -> SensorView:
    capabilities = {"measure_temperature": 21.5, "measure_co2": 600}

    return SensorView(id=device_id, name=name, sensor=sensor, capability_value=capabilities.get)
