"""Domain model of one S1 Pro."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from typing import ClassVar, Literal, Protocol, cast

from ..sensor.air_quality import AirQuality
from ..sensor.bindings import SettingBinding, SettingValue, TargetFeed, TrackedEntity
from ..sensor.events import (
    AirQualityChanged,
    PeopleCountChanged,
    PresenceChanged,
    SensorEvent,
    ZoneMovementChanged,
    ZonePresenceChanged,
)
from ..sensor.polygon import Polygon
from ..sensor.ports import EntityPort, EntityValue
from ..sensor.profile import S1ProProfile
from ..sensor.state_router import StateRouter
from ..sensor.target_tracker import TargetPosition, TargetTracker
from ..sensor.value_tracker import ValueTracker
from ..sensor.zone import Zone
from ..sensor.zone_repository import ZoneOptions, ZoneRepository
from ..timers import Debouncer, Timers
from ..utils import clamp, round_half_up, to_finite_number

type Sleep = Callable[[float], Awaitable[None]]

type ZoneKind = Literal["presence", "movement", "target_count"]
"""Zone state entity kinds, as named by the firmware."""


@dataclass(frozen=True, slots=True)
class ZoneStatus:
    presence: bool
    movement: bool
    people: int


class SensorObserver(Protocol):
    """Receives what the sensor model notices; implemented by the Homey device."""

    def on_sensor_connected(self) -> None: ...

    def on_sensor_disconnected(self) -> None: ...

    def on_zone_status(self, zone: Zone, status: ZoneStatus) -> None:
        """The status of a detection zone was reported."""

    def on_sensor_event(self, event: SensorEvent) -> None:
        """Something happened in the room."""

    def on_live(self) -> None:
        """Targets or presence changed (high frequency)."""

    def on_zones_changed(self) -> None:
        """Zone outlines changed (debounced)."""

    def on_settings_changed(self) -> None:
        """Setting entities changed (debounced)."""

    def on_bluetooth_proxy(self, enabled: bool) -> None:
        """The Bluetooth proxy was switched on or off."""


class S1ProSensor:
    """Domain model of one S1 Pro.

    Turns the raw entity stream of the port into meaningful state, queries and
    :class:`SensorEvent` notifications, and offers the commands the rest of
    the app needs. Knows nothing about Homey.
    """

    ZONE_SETTLE_MS: ClassVar[int] = 800
    """Quiet time before zone outlines are considered settled."""

    SETTINGS_SETTLE_MS: ClassVar[int] = 1000
    """Quiet time before setting values are considered settled."""

    _LIVE_ENTITIES: ClassVar[frozenset[str]] = frozenset(
        {
            S1ProProfile.PRESENCE,
            S1ProProfile.MOVEMENT,
            S1ProProfile.PEOPLE,
        }
    )
    """Entities whose changes are shown live on the radar."""

    def __init__(
        self,
        *,
        port: EntityPort,
        timers: Timers,
        observer: SensorObserver,
        sleep: Sleep = asyncio.sleep,
    ) -> None:
        self._port = port
        self._observer = observer
        self._sleep = sleep
        self._zones = ZoneRepository(port)
        self._values = ValueTracker()
        self._targets = TargetTracker()
        self._router = self._create_router()
        self._zones_settled = Debouncer(timers, self.ZONE_SETTLE_MS, observer.on_zones_changed)
        self._settings_settled = Debouncer(timers, self.SETTINGS_SETTLE_MS, observer.on_settings_changed)

        port.listen(self)

    def stop(self) -> None:
        """Drop pending notifications; the session itself is owned by the device."""
        self._zones_settled.cancel()
        self._settings_settled.cancel()

    # --- Queries --------------------------------------------------------------

    @property
    def connected(self) -> bool:
        return self._port.connected

    @property
    def present(self) -> bool:
        """Someone is in the room."""
        return self._values.get(S1ProProfile.PRESENCE, False)

    @property
    def moving(self) -> bool:
        """Someone in the room is moving."""
        return self._values.get(S1ProProfile.MOVEMENT, False)

    @property
    def people(self) -> int:
        """Number of people in the room."""
        return int(self._values.get(S1ProProfile.PEOPLE, 0))

    @property
    def targets(self) -> list[TargetPosition]:
        return self._targets.positions

    @property
    def detection_range(self) -> float:
        """Maximum detection distance in centimetres."""
        reported = self._port.get(S1ProProfile.DETECTION_RANGE)

        return to_finite_number(reported, S1ProProfile.DEFAULT_DETECTION_RANGE)

    @property
    def air_quality(self) -> AirQuality | None:
        """The air quality class, or ``None`` until the sensor reported one."""
        return self._values.get(S1ProProfile.AIR_QUALITY, None)

    def zone_status(self, zone: Zone) -> ZoneStatus:
        """Return the status of a detection zone."""
        return ZoneStatus(
            presence=self._values.get(zone.entity("presence"), False),
            movement=self._values.get(zone.entity("movement"), False),
            people=int(self._values.get(zone.entity("target_count"), 0)),
        )

    def is_zone_occupied(self, zone: Zone) -> bool:
        """True when the zone has an outline and someone is in it."""
        if not self._zones.is_configured(zone):
            return False

        return self.zone_status(zone).presence

    def is_zone_moving(self, zone: Zone) -> bool:
        """True when the zone has an outline and someone moves in it."""
        if not self._zones.is_configured(zone):
            return False

        return self.zone_status(zone).movement

    def zone_outline(self, zone: Zone) -> Polygon | None:
        """Return the outline, or ``None`` while it has not been fully received."""
        return self._zones.read(zone)

    def zone_options(self, zone: Zone) -> ZoneOptions:
        return self._zones.read_options(zone)

    def read_settings(self) -> dict[str, SettingValue]:
        """Return the setting values as reported by the sensor."""
        values: dict[str, SettingValue] = {}

        for binding in S1ProProfile.SETTINGS:
            value = binding.read(self._port)

            if value is not None:
                values[binding.key] = value

        return values

    # --- Commands -------------------------------------------------------------

    def set_zone_outline(self, zone: Zone, polygon: Polygon) -> None:
        """Write an outline; an empty polygon disables the zone."""
        self._zones.write(zone, polygon)

    def set_zone_options(
        self,
        zone: Zone,
        *,
        presence_delay: object = None,
        movement_threshold: object = None,
    ) -> None:
        """Write options of a detection zone; ``None`` leaves an option untouched."""
        self._zones.write_options(
            zone,
            presence_delay=presence_delay,
            movement_threshold=movement_threshold,
        )

    def apply_settings(self, entries: Iterable[tuple[str, SettingValue]]) -> list[str]:
        """Write settings to the sensor; unknown keys are ignored.

        Returns:
            The keys that were written.
        """
        bindings: dict[str, SettingBinding] = {}

        for binding in S1ProProfile.SETTINGS:
            bindings[binding.key] = binding

        written: list[str] = []

        for key, value in entries:
            binding = bindings.get(key)

            if binding is None:
                continue

            binding.write(self._port, value)
            written.append(key)

        return written

    async def beep(self, seconds: object) -> None:
        """Sound the buzzer for a while (clamped to 0.1-5 seconds)."""
        limits = S1ProProfile.BEEP_SECONDS
        fallback = S1ProProfile.BEEP_FALLBACK_SECONDS
        requested = to_finite_number(seconds, fallback)

        if requested == 0:
            requested = fallback

        duration = clamp(requested, limits.minimum, limits.maximum)

        self._port.set_switch(S1ProProfile.BUZZER, True)

        try:
            await self._sleep(duration)
        finally:
            self._port.set_switch(S1ProProfile.BUZZER, False)

    # --- Entity stream (EntityListener) ---------------------------------------

    def on_entities_connected(self) -> None:
        # Values re-sent after a reconnect must not fire flows.
        self._values.reset()
        self._zones_settled.schedule()
        self._settings_settled.schedule()
        self._observer.on_sensor_connected()

    def on_entities_disconnected(self) -> None:
        self._targets.reset()
        self._zones_settled.cancel()
        self._settings_settled.cancel()
        self._observer.on_sensor_disconnected()

    def on_entity_state(self, object_id: str, value: EntityValue) -> None:
        self._router.dispatch(object_id, value)

    # --- State routing --------------------------------------------------------

    def _create_router(self) -> StateRouter:
        router = StateRouter()

        for tracked in S1ProProfile.TRACKED:
            router.on(tracked.object_id, self._tracked_handler(tracked))

        for feed in S1ProProfile.TARGET_FEEDS:
            router.on(feed.pattern, self._target_handler(feed))

        router.on(S1ProProfile.ZONE_STATE, self._on_zone_state)
        router.on(S1ProProfile.ZONE_GEOMETRY, self._on_zone_geometry)
        router.on(self._setting_entities(), self._on_setting)
        router.on(S1ProProfile.BLUETOOTH_PROXY, self._on_bluetooth_proxy)
        router.on(S1ProProfile.AIR_QUALITY, self._on_air_quality)

        return router

    @staticmethod
    def _setting_entities() -> list[str]:
        object_ids: list[str] = []

        for binding in S1ProProfile.SETTINGS:
            object_ids.append(binding.object_id)

        return object_ids

    def _tracked_handler(self, tracked: TrackedEntity) -> Callable[[EntityValue, tuple[str, ...]], None]:
        def handle(value: EntityValue, groups: tuple[str, ...]) -> None:
            del groups
            self._on_tracked_state(tracked, value)

        return handle

    def _target_handler(self, feed: TargetFeed) -> Callable[[EntityValue, tuple[str, ...]], None]:
        def handle(value: EntityValue, groups: tuple[str, ...]) -> None:
            slot, axis = groups
            self._on_target_position(feed, int(slot) - 1, axis, value)

        return handle

    def _on_tracked_state(self, tracked: TrackedEntity, raw: EntityValue) -> None:
        value = tracked.convert(raw)
        change = self._values.update(tracked.object_id, value)

        if tracked.object_id in self._LIVE_ENTITIES:
            self._observer.on_live()

        if not change.changed:
            return

        if tracked.object_id == S1ProProfile.PRESENCE:
            self._observer.on_sensor_event(PresenceChanged(present=bool(value), people=self.people))

        if tracked.object_id == S1ProProfile.PEOPLE:
            previous = int(change.previous or 0)

            self._observer.on_sensor_event(PeopleCountChanged(people=int(value), previous=previous))

    def _on_target_position(self, feed: TargetFeed, slot: int, axis: str, value: EntityValue) -> None:
        position = to_finite_number(value, 0.0)
        changed = self._targets.update(slot, "x" if axis == "x" else "y", position, feed)

        # The official firmware repeats positions on every radar frame; only real moves count.
        if changed:
            self._observer.on_live()

    def _on_zone_state(self, raw: EntityValue, groups: tuple[str, ...]) -> None:
        zone_key, kind_name = groups
        zone = Zone.of(zone_key)
        kind = cast(ZoneKind, kind_name)
        value = self._parse_zone_value(kind, raw)
        change = self._values.update(zone.entity(kind), value)

        self._observer.on_zone_status(zone, self.zone_status(zone))
        self._observer.on_live()

        # Zones without an outline report stale values; never fire flows for them.
        if not change.changed or not self._zones.is_configured(zone):
            return

        if kind == "presence":
            self._emit_zone_presence(zone, bool(value))

        if kind == "movement":
            self._observer.on_sensor_event(ZoneMovementChanged(zone=zone, moving=bool(value)))

    def _on_zone_geometry(self, value: EntityValue, groups: tuple[str, ...]) -> None:
        del value, groups
        self._zones_settled.schedule()

    def _on_setting(self, value: EntityValue, groups: tuple[str, ...]) -> None:
        del value, groups
        self._settings_settled.schedule()

    def _on_bluetooth_proxy(self, value: EntityValue, groups: tuple[str, ...]) -> None:
        del groups
        enabled = bool(value)
        change = self._values.update(S1ProProfile.BLUETOOTH_PROXY, enabled)

        if change.initial or change.changed:
            self._observer.on_bluetooth_proxy(enabled)

    def _on_air_quality(self, value: EntityValue, groups: tuple[str, ...]) -> None:
        del groups
        quality = AirQuality.parse(value)

        # The firmware reports "error" while the IAQ is out of range; keep the last class.
        if quality is None:
            return

        change = self._values.update(S1ProProfile.AIR_QUALITY, quality)

        if change.changed and change.previous is not None:
            self._observer.on_sensor_event(AirQualityChanged(quality=quality, previous=change.previous))

    def _emit_zone_presence(self, zone: Zone, present: bool) -> None:
        # The people count can lag behind presence; someone entering is at least one person.
        people = 0

        if present:
            people = max(1, self.zone_status(zone).people)

        self._observer.on_sensor_event(ZonePresenceChanged(zone=zone, present=present, people=people))

    @staticmethod
    def _parse_zone_value(kind: ZoneKind, raw: EntityValue) -> bool | int:
        if kind == "target_count":
            return round_half_up(to_finite_number(raw, 0.0))

        return bool(raw)
