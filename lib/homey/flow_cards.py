"""The S1 Pro's own flow cards."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from typing import Any, Protocol

from ..sensor.air_quality import AirQuality
from ..sensor.events import (
    AirQualityChanged,
    PeopleCountChanged,
    PresenceChanged,
    SensorEvent,
    ZoneMovementChanged,
    ZonePresenceChanged,
)
from ..sensor.sensor import S1ProSensor
from ..sensor.zone import Zone
from ..utils import Logger, to_finite_number


class FlowDevice(Protocol):
    """What flow cards need from a device."""

    @property
    def sensor(self) -> S1ProSensor: ...


class TriggerCard(Protocol):
    def register_run_listener(self, listener: Callable[..., Awaitable[bool]]) -> object: ...

    async def trigger(self, device: Any, tokens: dict[str, Any], **trigger_kwargs: Any) -> None: ...


class RunListenerCard(Protocol):
    def register_run_listener(self, listener: Callable[..., Awaitable[Any]]) -> object: ...


class FlowManager(Protocol):
    """The subset of ``homey.flow`` used here."""

    def get_device_trigger_card(self, id: str) -> TriggerCard: ...

    def get_condition_card(self, id: str) -> RunListenerCard: ...

    def get_action_card(self, id: str) -> RunListenerCard: ...


class Cards:
    """Flow card ids, as declared in ``driver.flow.compose.json``."""

    ROOM_OCCUPIED = "room_occupied"
    ROOM_EMPTY = "room_empty"
    PEOPLE_CHANGED = "people_changed"
    ZONE_ENTERED = "zone_entered"
    ZONE_LEFT = "zone_left"
    ZONE_MOVEMENT_STARTED = "zone_movement_started"
    ZONE_MOVEMENT_STOPPED = "zone_movement_stopped"
    AIR_QUALITY_CHANGED = "air_quality_changed"

    IS_PRESENT = "is_present"
    ZONE_OCCUPIED = "zone_occupied"
    ZONE_MOVING = "zone_moving"
    PEOPLE_ABOVE = "people_above"
    AIR_QUALITY_AT_LEAST = "air_quality_at_least"

    SET_ZONE_DELAY = "set_zone_delay"
    BEEP = "beep"

    ZONE_TRIGGERS = (ZONE_ENTERED, ZONE_LEFT, ZONE_MOVEMENT_STARTED, ZONE_MOVEMENT_STOPPED)
    """Trigger cards with a zone dropdown; they only fire for the selected zone."""

    TRIGGERS = (ROOM_OCCUPIED, ROOM_EMPTY, PEOPLE_CHANGED, AIR_QUALITY_CHANGED, *ZONE_TRIGGERS)


@dataclass(frozen=True, slots=True)
class TriggerInvocation:
    card: str
    tokens: dict[str, Any] = field(default_factory=dict[str, Any])
    zone: str | None = None
    """Passed to the run listener of zone triggers."""


def dropdown_argument(value: object) -> object:
    """A dropdown argument (zone, air quality level): either its id or the selected ``{"id": ...}`` item."""
    if isinstance(value, Mapping):
        return value.get("id")  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]

    return value


class FlowCards:
    """Registers conditions and actions, and fires triggers for domain events."""

    def __init__(self, flow: FlowManager, logger: Logger) -> None:
        self._flow = flow
        self._logger = logger
        self._triggers: dict[str, TriggerCard] = {}

    def register(self) -> FlowCards:
        self._register_triggers()
        self._register_conditions()
        self._register_actions()

        return self

    async def dispatch(self, device: FlowDevice, event: SensorEvent) -> None:
        """Fire the trigger card that corresponds to a domain event."""
        invocation = self.translate(event)

        if invocation is None:
            return

        card = self._triggers.get(invocation.card)

        if card is None:
            return

        try:
            if invocation.zone is None:
                await card.trigger(device, invocation.tokens)
            else:
                await card.trigger(device, invocation.tokens, zone=invocation.zone)
        except Exception as error:  # noqa: BLE001 - a failing flow must not break the sensor
            self._logger.error(f"Trigger {invocation.card} failed:", error)

    @staticmethod
    def translate(event: SensorEvent) -> TriggerInvocation | None:  # noqa: PLR0911 - one case per card
        """Map a domain event onto the trigger card invocation it stands for."""
        match event:
            case PresenceChanged(present=True, people=people):
                return TriggerInvocation(Cards.ROOM_OCCUPIED, {"people": people})
            case PresenceChanged(present=False):
                return TriggerInvocation(Cards.ROOM_EMPTY)
            case PeopleCountChanged(people=people, previous=previous):
                return TriggerInvocation(Cards.PEOPLE_CHANGED, {"people": people, "previous": previous})
            case ZonePresenceChanged(zone=zone, present=True, people=people):
                return TriggerInvocation(Cards.ZONE_ENTERED, {"people": people}, zone.key)
            case ZonePresenceChanged(zone=zone, present=False):
                return TriggerInvocation(Cards.ZONE_LEFT, zone=zone.key)
            case ZoneMovementChanged(zone=zone, moving=True):
                return TriggerInvocation(Cards.ZONE_MOVEMENT_STARTED, zone=zone.key)
            case ZoneMovementChanged(zone=zone, moving=False):
                return TriggerInvocation(Cards.ZONE_MOVEMENT_STOPPED, zone=zone.key)
            case AirQualityChanged(quality=quality, previous=previous):
                return TriggerInvocation(
                    Cards.AIR_QUALITY_CHANGED,
                    {"air_quality": quality.key, "previous": previous.key},
                )
            case _:
                return None

    # --- Registration ---------------------------------------------------------

    def _register_triggers(self) -> None:
        for card_id in Cards.TRIGGERS:
            self._triggers[card_id] = self._flow.get_device_trigger_card(card_id)

        for card_id in Cards.ZONE_TRIGGERS:
            self._triggers[card_id].register_run_listener(self._matches_zone)

    def _register_conditions(self) -> None:
        self._flow.get_condition_card(Cards.IS_PRESENT).register_run_listener(self._is_present)
        self._flow.get_condition_card(Cards.ZONE_OCCUPIED).register_run_listener(self._zone_occupied)
        self._flow.get_condition_card(Cards.ZONE_MOVING).register_run_listener(self._zone_moving)
        self._flow.get_condition_card(Cards.PEOPLE_ABOVE).register_run_listener(self._people_above)
        self._flow.get_condition_card(Cards.AIR_QUALITY_AT_LEAST).register_run_listener(self._air_quality_at_least)

    def _register_actions(self) -> None:
        self._flow.get_action_card(Cards.SET_ZONE_DELAY).register_run_listener(self._set_zone_delay)
        self._flow.get_action_card(Cards.BEEP).register_run_listener(self._beep)

    # --- Run listeners --------------------------------------------------------

    @staticmethod
    async def _matches_zone(card_arguments: Mapping[str, Any], **trigger_kwargs: Any) -> bool:
        selected = dropdown_argument(card_arguments.get("zone"))

        return str(selected) == trigger_kwargs.get("zone")

    @staticmethod
    async def _is_present(card_arguments: Mapping[str, Any], **trigger_kwargs: Any) -> bool:
        del trigger_kwargs
        device: FlowDevice = card_arguments["device"]

        return device.sensor.present

    @staticmethod
    async def _zone_occupied(card_arguments: Mapping[str, Any], **trigger_kwargs: Any) -> bool:
        del trigger_kwargs
        device: FlowDevice = card_arguments["device"]
        zone = Zone.of(dropdown_argument(card_arguments.get("zone")))

        return device.sensor.is_zone_occupied(zone)

    @staticmethod
    async def _zone_moving(card_arguments: Mapping[str, Any], **trigger_kwargs: Any) -> bool:
        del trigger_kwargs
        device: FlowDevice = card_arguments["device"]
        zone = Zone.of(dropdown_argument(card_arguments.get("zone")))

        return device.sensor.is_zone_moving(zone)

    @staticmethod
    async def _people_above(card_arguments: Mapping[str, Any], **trigger_kwargs: Any) -> bool:
        del trigger_kwargs
        device: FlowDevice = card_arguments["device"]
        count = to_finite_number(card_arguments.get("count"), 0.0)

        return device.sensor.people > count

    @staticmethod
    async def _air_quality_at_least(card_arguments: Mapping[str, Any], **trigger_kwargs: Any) -> bool:
        """Whether the air is at least as polluted as the selected class."""
        del trigger_kwargs
        device: FlowDevice = card_arguments["device"]
        threshold = AirQuality.of(dropdown_argument(card_arguments.get("level")))
        quality = device.sensor.air_quality

        if quality is None:
            return False

        return quality.at_least_as_bad_as(threshold)

    @staticmethod
    async def _set_zone_delay(card_arguments: Mapping[str, Any], **trigger_kwargs: Any) -> None:
        del trigger_kwargs
        device: FlowDevice = card_arguments["device"]
        zone = Zone.detection(dropdown_argument(card_arguments.get("zone")))

        device.sensor.set_zone_options(zone, presence_delay=card_arguments.get("seconds"))

    @staticmethod
    async def _beep(card_arguments: Mapping[str, Any], **trigger_kwargs: Any) -> None:
        del trigger_kwargs
        device: FlowDevice = card_arguments["device"]

        await device.sensor.beep(card_arguments.get("duration"))
