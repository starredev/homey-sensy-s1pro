"""Composition root of the Sensy S1 Pro app."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

from homey.app import App
from homey.widget import SettingAutocompleteResult

from .lib.homey.presenter import SensorView
from .lib.homey.realtime_hub import RealtimeHub
from .lib.homey.sensy_api import SensyApi

if TYPE_CHECKING:
    from .drivers.s1pro.driver import S1ProDriver


class SensyApp(App):
    """Creates the app-wide services.

    Devices use them for realtime publishing; the web API modules (``api.py``
    and the widget's ``api.py``) use :attr:`sensy_api`.
    """

    DRIVER_ID = "s1pro"
    WIDGET_ID = "radar"

    _realtime: RealtimeHub
    _sensy_api: SensyApi

    async def on_init(self) -> None:
        await super().on_init()

        self._realtime = RealtimeHub(api=self.homey.api, timers=self.homey, logger=self)
        self._sensy_api = SensyApi(self._sensor_views)

        self._register_widget_settings()
        self.log("Sensy S1 Pro app started")

    async def on_uninit(self) -> None:
        self._realtime.dispose()
        await super().on_uninit()

    @property
    def realtime(self) -> RealtimeHub:
        return self._realtime

    @property
    def sensy_api(self) -> SensyApi:
        return self._sensy_api

    def publish_devices(self) -> None:
        """Tell the web views that the list of sensors (or their status) changed."""
        self._realtime.devices(self._sensor_views())

    def _sensor_views(self) -> list[SensorView]:
        try:
            driver = cast("S1ProDriver", self.homey.drivers.get_driver(self.DRIVER_ID))
        except Exception:  # noqa: BLE001 - the driver is not ready while the app is still starting
            return []

        views: list[SensorView] = []

        for device in driver.sensors:
            if device.ready_for_views:
                views.append(device.view)

        return views

    def _register_widget_settings(self) -> None:
        try:
            widget = self.homey.dashboards.get_widget(self.WIDGET_ID)

            widget.register_setting_autocomplete_listener("device", self._search_devices)
        except Exception as error:  # noqa: BLE001 - the app works without the widget
            self.error("Could not register the widget settings", error)

    async def _search_devices(self, query: str, settings: dict[str, Any]) -> list[SettingAutocompleteResult]:
        del settings
        needle = str(query or "").lower()
        results: list[SettingAutocompleteResult] = []

        for device in self._sensy_api.list_devices():
            if needle not in str(device["name"]).lower():
                continue

            # The widget reads the selection as `settings.device.id`.
            result = {
                "id": device["id"],
                "name": device["name"],
                "description": "Online" if device["connected"] else "Offline",
            }

            results.append(cast(SettingAutocompleteResult, result))

        return results


homey_export = SensyApp
