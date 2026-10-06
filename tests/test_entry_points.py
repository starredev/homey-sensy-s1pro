"""Static checks on the Homey entry points, which cannot be imported without the Homey runtime."""

from __future__ import annotations

import ast
from pathlib import Path
from typing import TypeGuard

ROOT = Path(__file__).resolve().parent.parent

DEVICE_INTERNALS = frozenset(
    {
        # homey.device.Device (Python SDK runtime)
        "_available",
        "_available_status_queue",
        "_call_handlers",
        "_capabilities",
        "_capabilities_options",
        "_capability_listeners",
        "_capability_queues",
        "_class",
        "_data",
        "_destroy_listeners",
        "_energy",
        "_events",
        "_id",
        "_last_seen_at",
        "_lock",
        "_name",
        "_on_settings_pending",
        "_ready_future",
        "_settings",
        "_state",
        "_store",
        "_unavailable_message",
        "_warning",
        # homey_esphomedriver.EspHomeDevice
        "_client",
        "_capability_handler",
        "_commands",
        "_state_handler",
    }
)


def _is_self_assignment(node: ast.AST) -> TypeGuard[ast.Attribute]:
    if not isinstance(node, ast.Attribute) or not isinstance(node.ctx, ast.Store):
        return False

    return isinstance(node.value, ast.Name) and node.value.id == "self"


def _assigned_attributes(path: Path) -> set[str]:
    """Names of every ``self.<name> = ...`` and class-level annotation in a module."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names: set[str] = set()

    for node in ast.walk(tree):
        if _is_self_assignment(node):
            names.add(node.attr)

        if isinstance(node, ast.ClassDef):
            for statement in node.body:
                if isinstance(statement, ast.AnnAssign) and isinstance(statement.target, ast.Name):
                    names.add(statement.target.id)

    return names


def _imports(path: Path) -> list[ast.ImportFrom]:
    tree = ast.parse(path.read_text(encoding="utf-8"))

    return [node for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)]


def test_device_does_not_overwrite_sdk_or_library_state() -> None:
    collisions = _assigned_attributes(ROOT / "drivers" / "s1pro" / "device.py") & DEVICE_INTERNALS

    assert collisions == set()


def test_app_code_imports_itself_relatively() -> None:
    """Homey loads the app as the package ``app`` (``app.app``, ``app.drivers.s1pro.device``),
    so ``lib`` is never a top-level module at runtime."""
    sources = [ROOT / "app.py", ROOT / "api.py", *ROOT.glob("drivers/*/*.py"), *ROOT.glob("lib/**/*.py")]
    absolute: list[str] = []

    for source in sources:
        for node in _imports(source):
            if node.level == 0 and (node.module or "").split(".")[0] in ("lib", "drivers", "app"):
                absolute.append(f"{source.relative_to(ROOT)}: from {node.module}")

    assert absolute == []
