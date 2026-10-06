# Testing and CI

## Python

```bash
ruff check . && ruff format --check .   # lint and formatting
pyright                                 # types: strict for lib/, standard for the entry points
pytest --cov                            # tests; coverage must stay above 85 %
```

| Test module | Covers |
|---|---|
| `tests/test_core.py` | Utilities, timers (debouncer, keyed throttle), errors, the task runner |
| `tests/test_domain.py` | Zones, polygons, value and target trackers, state router, setting bindings, zone repository, air quality |
| `tests/test_sensor.py` | The S1 Pro model: presence, people, targets and their states, zones, settings, air quality, buzzer |
| `tests/test_esphome.py` | The entity port on a fake session: state routing, commands, disconnects, stale sessions |
| `tests/test_homey.py` | Brand profile mapping (with the real library mapper), capability store, zone capabilities, settings mirror, flow cards, presenter, realtime hub, web API |
| `tests/test_firmware.py` | Version comparison, the firmware catalog, combined warnings, the firmware trigger |
| `tests/test_entry_points.py` | Static checks: relative imports only, no device attributes that shadow SDK or library internals |

`tests/fakes.py` has the test doubles: a manual clock, an in-memory entity port, recorders for observers, flows,
capabilities and realtime events. `build(Kind, **fields)` creates `aioesphomeapi` models, whose compiled
dataclasses hide their fields from type checkers.

The entry points (`app.py`, `drivers/`, `api.py`) need the Homey runtime and are not imported by the tests; keep
them thin.

## Web views

```bash
npm run lint            # ESLint
npm run test:coverage   # node:test with coverage thresholds for widgets/radar/public/lib
npm run check           # both
```

Keep DOM-free logic (geometry, drafts, styles) in its own modules so it can be tested without a browser.

## Manifest

```bash
homey app validate --level publish
```

This compiles the Python dependencies in Docker the first time (see the [Windows note](development.md#windows)).

## CI

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests:

| Job | Steps |
|---|---|
| Python lint, type-check and test | uv with Python 3.14, `ruff check`, `ruff format --check`, `pyright`, `pytest --cov` |
| Web views lint and test | Node 22, `npm ci`, `npm run check` |
| Validate the app manifest | QEMU for arm64, the Homey CLI, `homey app validate --level publish` |

`.github/workflows/docs.yml` builds and publishes this documentation site; see [Documentation site](docs.md).
