"""The port through which the sensor model reads and writes ESPHome entities.

The model depends on these protocols only; ``lib.esphome`` implements them on
top of the ``homey-esphomedriver`` session, tests implement them with fakes.
"""

from __future__ import annotations

from typing import Protocol

type EntityValue = bool | float | str
"""A state as reported by an ESPHome entity."""


class EntityListener(Protocol):
    """Receives the entity stream of one sensor."""

    def on_entities_connected(self) -> None:
        """The session is up and entities are known; their states follow."""

    def on_entities_disconnected(self) -> None:
        """The session dropped; cached values are stale."""

    def on_entity_state(self, object_id: str, value: EntityValue) -> None:
        """An entity reported a state."""


class EntityPort(Protocol):
    """Typed access to the entities of one ESPHome device, by object id."""

    @property
    def connected(self) -> bool:
        """Whether commands can be sent."""
        ...

    def listen(self, listener: EntityListener) -> None:
        """Register the one listener of this port."""

    def get(self, object_id: str) -> EntityValue | None:
        """Return the last reported value, or ``None`` when none was received."""
        ...

    def set_number(self, object_id: str, value: float) -> None:
        """Write a ``number:`` entity.

        Raises:
            NotConnectedError: When the sensor is offline or the entity is unknown.
        """

    def set_switch(self, object_id: str, on: bool) -> None:
        """Turn a ``switch:`` entity on or off.

        Raises:
            NotConnectedError: When the sensor is offline or the entity is unknown.
        """
