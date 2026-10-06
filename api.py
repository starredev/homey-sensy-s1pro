"""Web API of the app (see ``api`` in ``.homeycompose/app.json``).

Each endpoint is a thin adapter onto :class:`lib.homey.sensy_api.SensyApi`.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

from homey.homey import Homey

from .lib.homey.sensy_api import SensyApi

if TYPE_CHECKING:
    from .app import SensyApp


def _sensy_api(homey: Homey) -> SensyApi:
    app = cast("SensyApp", homey.app)

    return app.sensy_api


async def get_devices(*, homey: Homey, query: dict[str, str], params: dict[str, str], body: Any) -> Any:
    del query, params, body

    return _sensy_api(homey).list_devices()


async def get_device(*, homey: Homey, query: dict[str, str], params: dict[str, str], body: Any) -> Any:
    del query, body

    return _sensy_api(homey).get_snapshot(params.get("id"))


async def set_zone(*, homey: Homey, query: dict[str, str], params: dict[str, str], body: Any) -> Any:
    del query

    return _sensy_api(homey).set_zone(params.get("id"), params.get("zone"), body)


async def set_zone_options(*, homey: Homey, query: dict[str, str], params: dict[str, str], body: Any) -> Any:
    del query

    return _sensy_api(homey).set_zone_options(params.get("id"), params.get("zone"), body)


__all__ = ["get_device", "get_devices", "set_zone", "set_zone_options"]
