"""Entities of one ESPHome device, addressed by object id."""

from __future__ import annotations

from typing import Protocol

from aioesphomeapi import (
    BinarySensorState,
    EntityInfo,
    EntityState,
    NumberInfo,
    NumberState,
    SensorState,
    SwitchInfo,
    SwitchState,
    TextSensorState,
    UserService,
)
from aioesphomeapi.client import APIClient
from aioesphomeapi.core import APIConnectionError

from ..errors import NotConnectedError, ValidationError
from ..sensor.ports import EntityListener, EntityValue


class Session(Protocol):
    """The subset of ``homey_esphomedriver.EspHomeClient`` used here."""

    @property
    def available(self) -> bool:
        """Whether the session accepts commands."""
        ...

    @property
    def api(self) -> APIClient: ...

    async def list_entities_services(self) -> tuple[list[EntityInfo], list[UserService]]: ...

    def command(self, name: str, *args: object, **kwargs: object) -> None: ...


class _NoListener:
    def on_entities_connected(self) -> None:
        pass

    def on_entities_disconnected(self) -> None:
        pass

    def on_entity_state(self, object_id: str, value: EntityValue) -> None:
        del object_id, value


class EsphomeEntities:
    """Implements the sensor model's entity port on a Native API session.

    ``homey-esphomedriver`` owns the session (connect, reconnect, encryption)
    and maps the primary entities onto capabilities. This class opens a second
    state subscription on that session for everything the model needs beyond
    capabilities: zones, targets and setting entities. The last reported value
    of every entity is cached, so the model can read state synchronously.
    """

    def __init__(self) -> None:
        self._listener: EntityListener = _NoListener()
        self._session: Session | None = None
        self._by_key: dict[int, EntityInfo] = {}
        self._by_object_id: dict[str, EntityInfo] = {}
        self._values: dict[str, EntityValue] = {}

    def listen(self, listener: EntityListener) -> None:
        self._listener = listener

    @property
    def connected(self) -> bool:
        session = self._session

        if session is None:
            return False

        return session.available

    async def attach(self, session: Session) -> None:
        """Index the entities of a freshly logged-in session and follow its states.

        Called after every (re)connect, before the session accepts commands.
        """
        entities, _services = await session.list_entities_services()

        self._session = session
        self._index(entities)
        self._listener.on_entities_connected()

        def on_state(state: EntityState) -> None:
            # A state from a session that was replaced in the meantime is stale.
            if self._session is session:
                self._on_state(state)

        session.api.subscribe_states(on_state)

    def detach(self) -> None:
        """Forget the session after it dropped or stopped."""
        if self._session is None:
            return

        self._session = None
        self._by_key.clear()
        self._by_object_id.clear()
        self._listener.on_entities_disconnected()

    def get(self, object_id: str) -> EntityValue | None:
        return self._values.get(object_id)

    def set_number(self, object_id: str, value: float) -> None:
        info = self._commandable(object_id, NumberInfo)

        self._send("number_command", info, float(value))

    def set_switch(self, object_id: str, on: bool) -> None:
        info = self._commandable(object_id, SwitchInfo)

        self._send("switch_command", info, bool(on))

    def _index(self, entities: list[EntityInfo]) -> None:
        self._by_key.clear()
        self._by_object_id.clear()

        for info in entities:
            self._by_key[info.key] = info
            self._by_object_id[info.object_id] = info

    def _on_state(self, state: EntityState) -> None:
        info = self._by_key.get(state.key)

        if info is None:
            return

        value = self._value_of(state)

        if value is None:
            return

        self._values[info.object_id] = value
        self._listener.on_entity_state(info.object_id, value)

    @staticmethod
    def _value_of(state: EntityState) -> EntityValue | None:
        """The plain value of a state, or ``None`` for missing states and other domains."""
        if isinstance(state, (BinarySensorState, SensorState, NumberState, TextSensorState)):
            if state.missing_state:
                return None

            return state.state

        if isinstance(state, SwitchState):
            return state.state

        return None

    def _commandable[I: EntityInfo](self, object_id: str, kind: type[I]) -> I:
        info = self._by_object_id.get(object_id)

        if info is None or not self.connected:
            raise NotConnectedError(object_id)

        if not isinstance(info, kind):
            raise ValidationError(f"{object_id} is a {type(info).__name__}, not a {kind.__name__}")

        return info

    def _send(self, command: str, info: EntityInfo, value: float | bool) -> None:
        session = self._session

        if session is None:
            raise NotConnectedError(info.object_id)

        try:
            session.command(command, info.key, value, device_id=info.device_id)
        except APIConnectionError as error:
            raise NotConnectedError(info.object_id) from error
