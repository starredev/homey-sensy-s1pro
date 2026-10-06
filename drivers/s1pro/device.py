"""Homey device of one S1 Pro."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

from homey_esphomedriver import EspHomeClient, EspHomeDevice

from ...lib.errors import NotConnectedError
from ...lib.esphome.entities import EsphomeEntities
from ...lib.homey.app_port import SensyAppPort
from ...lib.homey.capability_store import CapabilityStore
from ...lib.homey.presenter import SensorView
from ...lib.homey.settings_mirror import SettingsMirror
from ...lib.homey.tasks import TaskRunner
from ...lib.homey.zone_capabilities import ZoneCapabilities
from ...lib.sensor.events import SensorEvent
from ...lib.sensor.sensor import S1ProSensor, ZoneStatus
from ...lib.sensor.zone import Zone

if TYPE_CHECKING:
    from .driver import S1ProDriver


class S1ProDevice(EspHomeDevice):
    """Wires the sensor model to Homey; holds no domain logic.

    ``homey-esphomedriver`` owns the Native API session and the primary
    capabilities. This device attaches the sensor model to that session and
    adds what the generic mapping cannot know: zones, targets, flow triggers,
    mirrored settings and the realtime channels of the web views.
    """

    REFRESH_CAPABILITY = "button.refresh"

    _components_ready: bool = False
    _tasks: TaskRunner
    _entities: EsphomeEntities
    _sensor: S1ProSensor
    _capability_store: CapabilityStore
    _zone_capabilities: ZoneCapabilities
    _settings_mirror: SettingsMirror

    # --- homey-esphomedriver hooks --------------------------------------------

    async def on_esphome_init(self, client: EspHomeClient | None) -> None:
        await super().on_esphome_init(client)
        self._ensure_components()

        # Refreshing capabilities rebuilds them from the entity list and drops the
        # zone capabilities this app adds; put those back afterwards.
        self.register_capability_listener(self.REFRESH_CAPABILITY, self._on_refresh_capabilities)

    async def on_esphome_connected(self, client: EspHomeClient) -> None:
        await super().on_esphome_connected(client)
        self._ensure_components()
        await self._entities.attach(client)

    async def on_esphome_uninit(self) -> None:
        if self._components_ready:
            self._sensor.stop()
            self._entities.detach()

        await super().on_esphome_uninit()

    async def _on_disconnected(self, expected: bool) -> None:
        # homey-esphomedriver has no public disconnect hook yet.
        await super()._on_disconnected(expected)

        if self._components_ready:
            self._entities.detach()

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

    def on_zone_status(self, zone: Zone, status: ZoneStatus) -> None:
        self._tasks.run(self._zone_capabilities.update(zone, status))

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
        self._zone_capabilities = ZoneCapabilities(self._capability_store)
        self._settings_mirror = SettingsMirror(self, self._sensor)
        self._components_ready = True

    async def _apply_zones(self) -> None:
        sensor = self._sensor

        await self._zone_capabilities.reconcile(sensor.zone_outline, sensor.zone_status)
        self._app.realtime.zones(self.view)

    async def _on_refresh_capabilities(self, value: Any = True, **kwargs: Any) -> None:
        await self._capability_handler.refresh(value, **kwargs)
        await self._apply_zones()

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
