"""Dispatches entity states to handlers by object id."""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass

from ..sensor.ports import EntityValue

type RouteHandler = Callable[[EntityValue, tuple[str, ...]], None]
"""Receives the reported value and the regex groups (empty for exact matches)."""


@dataclass(frozen=True, slots=True)
class _PatternRoute:
    pattern: re.Pattern[str]
    handler: RouteHandler


class StateRouter:
    """Routes entity states to handlers.

    Exact ids are resolved through a dict; patterns are tried in registration
    order. The first matching route wins.
    """

    def __init__(self) -> None:
        self._exact: dict[str, RouteHandler] = {}
        self._patterns: list[_PatternRoute] = []

    def on(self, matcher: str | Iterable[str] | re.Pattern[str], handler: RouteHandler) -> StateRouter:
        """Register a handler for one id, several ids or a pattern."""
        if isinstance(matcher, re.Pattern):
            self._patterns.append(_PatternRoute(matcher, handler))

            return self

        object_ids = [matcher] if isinstance(matcher, str) else matcher

        for object_id in object_ids:
            self._exact[object_id] = handler

        return self

    def dispatch(self, object_id: str, value: EntityValue) -> bool:
        """Run the handler of an entity; return whether a route handled it."""
        exact = self._exact.get(object_id)

        if exact is not None:
            exact(value, ())

            return True

        for route in self._patterns:
            match = route.pattern.fullmatch(object_id)

            if match is not None:
                route.handler(value, match.groups())

                return True

        return False
