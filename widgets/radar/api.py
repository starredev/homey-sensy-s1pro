"""API of the radar widget."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

from homey.homey import Homey

if TYPE_CHECKING:
    from ...app import SensyApp


async def get_state(*, homey: Homey, query: dict[str, str], params: dict[str, str], body: Any) -> Any:
    """State of the sensor selected in the widget settings (or the first one)."""
    del params, body
    app = cast("SensyApp", homey.app)

    return app.sensy_api.get_snapshot(query.get("id"))


__all__ = ["get_state"]
