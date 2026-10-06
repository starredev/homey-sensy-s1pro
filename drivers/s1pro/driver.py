"""Driver of the Sensy-One S1 Pro Multi Sense."""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from homey_esphomedriver import EspHomeDriver

from ...lib.homey.brand_profile import SENSY_BRAND_PROFILE
from ...lib.homey.flow_cards import FlowCards

if TYPE_CHECKING:
    from .device import S1ProDevice


class S1ProDriver(EspHomeDriver):
    """Pairing, discovery and reconnects come from ``homey-esphomedriver``.

    This driver adds the brand profile (which entities become capabilities)
    and the S1 Pro's own flow cards.
    """

    brand_profile = SENSY_BRAND_PROFILE  # pyright: ignore[reportIncompatibleMethodOverride, reportAssignmentType]

    _flow_cards: FlowCards

    async def on_esphome_init(self) -> None:
        await super().on_esphome_init()

        self._flow_cards = FlowCards(self.homey.flow, self).register()

    @property
    def flow_cards(self) -> FlowCards:
        return self._flow_cards

    @property
    def sensors(self) -> list[S1ProDevice]:
        devices: list[S1ProDevice] = []

        for device in self.get_devices():
            devices.append(cast("S1ProDevice", device))

        return devices


homey_export = S1ProDriver
