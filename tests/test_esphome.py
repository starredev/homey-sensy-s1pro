"""The entity port on top of a Native API session."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, cast

import pytest
from aioesphomeapi import (
    BinarySensorInfo,
    BinarySensorState,
    EntityInfo,
    EntityState,
    LightState,
    NumberInfo,
    NumberState,
    SensorInfo,
    SensorState,
    SwitchInfo,
    SwitchState,
    TextSensorInfo,
    TextSensorState,
    UserService,
)
from aioesphomeapi.client import APIClient
from aioesphomeapi.core import APIConnectionError

from lib.errors import NotConnectedError, ValidationError
from lib.esphome.entities import EsphomeEntities
from lib.sensor.ports import EntityValue
from tests.fakes import build

ENTITIES: list[EntityInfo] = [
    build(BinarySensorInfo, key=1, object_id="any_presence"),
    build(SensorInfo, key=2, object_id="target_1_x"),
    build(NumberInfo, key=3, object_id="detection_range", device_id=7),
    build(SwitchInfo, key=4, object_id="mlt8530___buzzer"),
    build(TextSensorInfo, key=5, object_id="target_1_state"),
]


class FakeApi:
    def __init__(self) -> None:
        self.subscriptions: list[Callable[[EntityState], None]] = []

    def subscribe_states(self, on_state: Callable[[EntityState], None]) -> None:
        self.subscriptions.append(on_state)

    def emit(self, state: EntityState) -> None:
        for subscription in self.subscriptions:
            subscription(state)


class FakeSession:
    def __init__(self) -> None:
        self.available = True
        self.fake_api = FakeApi()
        self.commands: list[tuple[str, tuple[object, ...], dict[str, object]]] = []
        self.fail_commands = False

    @property
    def api(self) -> APIClient:
        return cast(APIClient, self.fake_api)

    async def list_entities_services(self) -> tuple[list[EntityInfo], list[UserService]]:
        return ENTITIES, []

    def command(self, name: str, *args: object, **kwargs: object) -> None:
        if self.fail_commands:
            raise APIConnectionError("not ready")

        self.commands.append((name, args, kwargs))


class RecordingListener:
    def __init__(self) -> None:
        self.calls: list[Any] = []

    def on_entities_connected(self) -> None:
        self.calls.append("connected")

    def on_entities_disconnected(self) -> None:
        self.calls.append("disconnected")

    def on_entity_state(self, object_id: str, value: EntityValue) -> None:
        self.calls.append((object_id, value))


async def _attached() -> tuple[EsphomeEntities, FakeSession, RecordingListener]:
    entities = EsphomeEntities()
    session = FakeSession()
    listener = RecordingListener()

    entities.listen(listener)
    await entities.attach(session)

    return entities, session, listener


class TestEsphomeEntities:
    async def test_routes_states_by_object_id(self) -> None:
        entities, session, listener = await _attached()

        session.fake_api.emit(build(BinarySensorState, key=1, state=True))
        session.fake_api.emit(build(SensorState, key=2, state=12.5))
        session.fake_api.emit(build(SensorState, key=2, state=0, missing_state=True))
        session.fake_api.emit(build(SwitchState, key=4, state=True))
        session.fake_api.emit(build(TextSensorState, key=5, state="moving"))
        session.fake_api.emit(build(NumberState, key=3, state=600))
        session.fake_api.emit(build(LightState, key=99, state=True))
        session.fake_api.emit(build(LightState, key=1, state=True))

        assert listener.calls == [
            "connected",
            ("any_presence", True),
            ("target_1_x", 12.5),
            ("mlt8530___buzzer", True),
            ("target_1_state", "moving"),
            ("detection_range", 600),
        ]
        assert entities.get("target_1_x") == 12.5
        assert entities.get("unknown") is None
        assert entities.connected

    async def test_commands_use_entity_keys(self) -> None:
        entities, session, _ = await _attached()

        entities.set_number("detection_range", 450)
        entities.set_switch("mlt8530___buzzer", True)

        assert session.commands == [
            ("number_command", (3, 450.0), {"device_id": 7}),
            ("switch_command", (4, True), {"device_id": 0}),
        ]

    async def test_command_errors(self) -> None:
        entities, session, _ = await _attached()

        with pytest.raises(NotConnectedError):
            entities.set_number("unknown", 1)

        with pytest.raises(ValidationError):
            entities.set_number("mlt8530___buzzer", 1)

        session.fail_commands = True

        with pytest.raises(NotConnectedError):
            entities.set_switch("mlt8530___buzzer", False)

        session.available = False

        with pytest.raises(NotConnectedError):
            entities.set_switch("mlt8530___buzzer", False)

    async def test_detach_ignores_the_old_session(self) -> None:
        entities, session, listener = await _attached()

        entities.detach()
        entities.detach()
        session.fake_api.emit(build(BinarySensorState, key=1, state=True))

        assert listener.calls == ["connected", "disconnected"]
        assert not entities.connected

        with pytest.raises(NotConnectedError):
            entities.set_switch("mlt8530___buzzer", True)

    async def test_send_without_session(self) -> None:
        entities, _, _ = await _attached()

        entities._session = None

        with pytest.raises(NotConnectedError):
            entities._send("switch_command", ENTITIES[3], True)

    async def test_works_without_listener(self) -> None:
        entities = EsphomeEntities()
        session = FakeSession()

        await entities.attach(session)
        session.fake_api.emit(build(BinarySensorState, key=1, state=True))
        entities.detach()

        assert entities.get("any_presence") is True
