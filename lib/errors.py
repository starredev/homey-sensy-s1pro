"""Error hierarchy of the app.

Every error carries a stable machine-readable ``code``, so API consumers (the
widget and the zone editor) can react without parsing human-readable messages.
"""

from __future__ import annotations


class SensyError(Exception):
    """Base class of all app errors."""

    code: str = "SENSY_ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ValidationError(SensyError):
    """Input that does not satisfy the domain rules."""

    code = "VALIDATION"


class NotConnectedError(SensyError):
    """A command was issued while the sensor is offline."""

    code = "NOT_CONNECTED"

    def __init__(self, detail: str | None = None) -> None:
        if detail:
            super().__init__(f"Sensor not connected ({detail})")
        else:
            super().__init__("Sensor not connected")


class NotFoundError(SensyError):
    """A requested resource (sensor, zone, entity) does not exist."""

    code = "NOT_FOUND"
