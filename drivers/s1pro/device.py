"""Homey device of one S1 Pro."""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from homey_esphomedriver import EspHomeClient, EspHomeDevice

from ...lib.errors import NotConnectedError
from ...lib.esphome.entities import EsphomeEntities
from ...lib.homey.app_port import SensyAppPort
from ...lib.homey.brand_profile import SensyBrandProfile
from ...lib.homey.capability_store import CapabilityStore
from ...lib.homey.presenter import SensorView
from ...lib.homey.settings_mirror import SettingsMirror
from ...lib.homey.tasks import TaskRunner
from ...lib.homey.zone_capabilities import ZoneCapabilities
from ...lib.sensor.events import SensorEvent
from ...lib.sensor.sensor import S1ProSensor

if TYPE_CHECKING:
    from .driver import S1ProDriver


class S1ProDevice(EspHomeDevice):
    """Wires the sensor model to Homey; holds no domain logic.

    ``homey-esphomedriver`` owns the Native API session and all capabilities.
    This device attaches the sensor model to that session and adds what the
    generic mapping cannot know: which zones are drawn, targets, flow
    triggers, mirrored settings and the realtime channels of the web views.
    """

    REFRESH_CAPABILITY = "button.refresh"
    """The library's maintenance action that rebuilds the capabilities."""

    DRAWN_ZONES_STORE = "drawn_zones"

    _components_ready: bool = False
    _tasks: TaskRunner
    _entities: EsphomeEntities
    _sensor: S1ProSensor
    _capability_store: CapabilityStore
    _settings_mirror: SettingsMirror

    # --- homey-esphomedriver hooks --------------------------------------------

    @property
    def brand_profile(self) -> SensyBrandProfile:  # pyright: ignore[reportIncompatibleVariableOverride]
        """The driver's profile, plus the zones this sensor has drawn.

        The library maps (and refreshes) capabilities with this profile, so the
        zone capabilities follow the drawn zones without any special casing.
        """
        profile = cast(SensyBrandProfile, self.driver.brand_profile)

        return profile.with_zones(self._stored_drawn_zones())

    async def on_esphome_init(self, client: EspHomeClient | None) -> None:
        await super().on_esphome_init(client)
        self._ensure_components()

    async def on_esphome_connected(self, client: EspHomeClient) -> None:
        await super().on_esphome_connected(client)
        self._ensure_components()
        await self._entities.attach(client)

    async def on_esphome_uninit(self) -> None:
        if self._components_ready:
            self._sensor.stop()
            self._entities.detach()

        await super().on_esphome_uninit()

    # --- Homey hooks ----------------------------------------------------------

    async def on_settings(
        self,
        old_settings: dict[str, bool | float | str | None],
        new_settings: dict[str, bool | float | str | None],
        changed_keys: tuple[str, ...],
    ) -> str | None:
        message = await super().on_settings(old_settings, new_settings, changed_keys)

        try:
            self._settings_mirror.push(new_settings, changed_keys)
        except NotConnectedError as error:
            raise Exception(self.homey.translate("device.not_connected") or error.message) from error

        return message

    # --- Read model -----------------------------------------------------------

    @property
    def sensor(self) -> S1ProSensor:
        """The domain model; used by flow cards and the API."""
        return self._sensor

    @property
    def ready_for_views(self) -> bool:
        return self._components_ready

    @property
    def view(self) -> SensorView:
        return SensorView(
            id=str(self.get_data()["id"]),
            name=self.get_name(),
            sensor=self._sensor,
            capability_value=self._capability_store.get,
        )

    # --- SensorObserver -------------------------------------------------------

    def on_sensor_connected(self) -> None:
        self._app.publish_devices()

    def on_sensor_disconnected(self) -> None:
        self._app.publish_devices()

    def on_sensor_event(self, event: SensorEvent) -> None:
        self._tasks.run(self._driver.flow_cards.dispatch(self, event))

    def on_live(self) -> None:
        self._app.realtime.live(self.view)

    def on_zones_changed(self) -> None:
        self._tasks.run(self._apply_zones())

    def on_settings_changed(self) -> None:
        self._tasks.run(self._settings_mirror.pull())

    def on_bluetooth_proxy(self, enabled: bool) -> None:
        self._tasks.run(self._show_bluetooth_proxy_warning(enabled))

    # --- Internals ------------------------------------------------------------

    def _ensure_components(self) -> None:
        """Create the app components once; the session may log in before ``on_esphome_init`` returns."""
        if self._components_ready:
            return

        self._tasks = TaskRunner(self)
        self._entities = EsphomeEntities()
        self._sensor = S1ProSensor(port=self._entities, timers=self.homey, observer=self)
        self._capability_store = CapabilityStore(self, self)
        self._settings_mirror = SettingsMirror(self, self._sensor)
        self._components_ready = True

    async def _apply_zones(self) -> None:
        drawn = ZoneCapabilities.drawn(self._sensor.zone_outline)

        if drawn is not None:
            await self._follow_drawn_zones(drawn)

        self._app.realtime.zones(self.view)

    async def _follow_drawn_zones(self, drawn: frozenset[str]) -> None:
        """Remember the drawn zones and let the library rebuild the capabilities when they differ."""
        present = ZoneCapabilities.present(self.get_capabilities())
        bound = self._bound_zone_capabilities()

        if bound != present or not present <= ZoneCapabilities.canonical():
            # Left over from an older version, or duplicated by a refresh. The library
            # keeps odd ids next to the ones it adds, so let it remove every zone
            # capability first (a refresh without drawn zones), then add them cleanly.
            self.log(f"Rebuilding zone capabilities {sorted(present)}")
            await self._refresh_with_zones(frozenset())
        elif bound == ZoneCapabilities.expected(drawn) and drawn == self._stored_drawn_zones():
            return

        self.log(f"Drawn zones are now {sorted(drawn)}; refreshing capabilities")
        await self._refresh_with_zones(drawn)

    async def _refresh_with_zones(self, drawn: frozenset[str]) -> None:
        """Store the drawn zones (read by ``brand_profile``) and press the library's refresh action."""
        await self.set_store_value(self.DRAWN_ZONES_STORE, sorted(drawn))
        await self.trigger_capability_listener(self.REFRESH_CAPABILITY, True)

    def _bound_zone_capabilities(self) -> frozenset[str]:
        """Zone capabilities that the library feeds (they carry the entity key)."""
        bound: set[str] = set()

        for capability in ZoneCapabilities.present(self.get_capabilities()):
            if self._is_bound(capability):
                bound.add(capability)

        return frozenset(bound)

    def _is_bound(self, capability: str) -> bool:
        try:
            options = self.get_capability_options(capability)
        except Exception:  # noqa: BLE001 - Homey raises for options stored as null
            return False

        return options.get("key") is not None

    def _stored_drawn_zones(self) -> frozenset[str]:
        stored = self.get_store().get(self.DRAWN_ZONES_STORE) or []

        return frozenset(str(key) for key in stored)

    async def _show_bluetooth_proxy_warning(self, enabled: bool) -> None:
        if enabled:
            await self.set_warning(self.homey.translate("device.bluetooth_proxy_on"))
        else:
            await self.unset_warning()

    @property
    def _app(self) -> SensyAppPort:
        return cast(SensyAppPort, self.homey.app)

    @property
    def _driver(self) -> S1ProDriver:
        return cast("S1ProDriver", self.driver)


homey_export = S1ProDevice
