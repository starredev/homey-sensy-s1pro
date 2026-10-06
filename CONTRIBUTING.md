# Contributing

Thanks for helping out. Bug reports, tested sensor setups and pull requests are all welcome.

## Development setup

The app is a Homey **Python** app (Python 3.14). The web views (widget and zone editor) are plain
JavaScript with their own Node tooling. You need:

- Python 3.14 and [uv](https://docs.astral.sh/uv/)
- Node.js 22 and the Homey CLI (`npm install --global homey`)
- Docker: the Homey CLI compiles the Python dependencies for arm64 and amd64 in containers

```bash
uv venv --python 3.14
uv pip install -r requirements-dev.txt
npm install
```

Everything CI runs:

```bash
ruff check . && ruff format --check .   # lint and formatting
pyright                                 # types (strict for lib/)
pytest --cov                            # tests, coverage must stay above 85%
npm run check                           # web views: ESLint and node:test with coverage
homey app validate --level publish      # manifest
```

To try the app on your own Homey:

```bash
homey login
homey select
homey app run
```

> **Windows:** the compiled dependency cache (`python_packages/`) contains Linux symlinks that Windows
> cannot copy without Developer Mode, which makes the CLI fail with *Error while collecting cross-compiled
> virtual environment*. Either enable Developer Mode, or delete the `python*` links in
> `python_packages/*/.venv/bin/` and the `lib64` link in `python_packages/*/.venv/` once after
> `homey app dependencies install`; the CLI removes those links from the build anyway.

## How the code is organised

```
app.py  api.py  drivers/s1pro/       Homey entry points (thin adapters)
lib/homey/                           Brand profile, flow cards, zone capabilities, settings,
                                     realtime updates and the web API service
lib/esphome/                         The entity port on top of the homey-esphomedriver session
lib/sensor/                          The S1 Pro model: zones, targets, events, firmware profile
lib/errors.py  timers.py  utils.py   Shared building blocks
widgets/radar/                       Dashboard widget: api.py, plus the browser modules the
                                     zone editor reuses (public/lib/)
settings/                            Zone editor (app settings page)
tests/                               Python tests and test doubles (fakes.py)
test/                                Tests of the browser modules
```

Dependencies only point downwards in this list: `lib/sensor` never imports `homey`, the ESPHome client
or `homey-esphomedriver`, so it runs under plain `pytest`.

`app.json` is generated. Edit the files in `.homeycompose/` and `drivers/*/*.compose.json`.

### What homey-esphomedriver does, and what this app adds

[`homey-esphomedriver`](https://github.com/Doekse/homey-esphomedriver) owns the Native API session:
discovery, pairing (including *Add by IP…* and encryption keys), reconnects, following IP changes, and
mapping entities onto capabilities. `S1ProDriver` and `S1ProDevice` extend its `EspHomeDriver` and
`EspHomeDevice` and only use the documented hooks (`on_esphome_init`, `on_esphome_connected`,
`on_esphome_uninit`), with two exceptions that wait for an upstream hook: `_on_disconnected` and the
*Refresh capabilities* listener.

`SensyBrandProfile` (in `lib/homey/brand_profile.py`) tells the library which entities become
capabilities. The sensor reports about 150 entities, most without an entity category, so the profile
whitelists the primary ones (`S1ProProfile.CAPABILITIES`) and leaves zones, targets and tuning numbers
to this app.

These files come from the library and are refreshed with `esphome-homey sync` after an upgrade:
`.homeycompose/drivers/templates/`, `.homeycompose/drivers/pair|repair/`, `.homeycompose/flow/`,
the generic capabilities in `.homeycompose/capabilities/` and `assets/capabilities/`, and the library
keys in `locales/`. Afterwards, delete the generated `.homeycompose/discovery/esphome.json` and
`assets/logo.svg` (this app uses its own), and copy new settings from the template into
`drivers/s1pro/driver.settings.compose.json` if the library added any.

### Data flow

```
ESPHome entity state (second subscription on the library's session)
  → EsphomeEntities        caches the value by object id
  → StateRouter            routes by object id / pattern
  → S1ProSensor            tracks state, notifies its SensorObserver:
                           zone status, live frames, zones, settings, domain events
  → S1ProDevice            ZoneCapabilities / SettingsMirror
                           FlowCards.dispatch(event)  →  trigger cards
                           RealtimeHub.live(view)     →  widget, zone editor
```

The primary capabilities (presence, movement, people, environment) are written by the library itself.
Commands go the other way: a flow card, the web API or a settings change calls the sensor
(`set_zone_outline`, `set_zone_options`, `apply_settings`, `beep`), which writes entities through the port.

### Key types

| Type | Folder | Responsibility |
|---|---|---|
| `S1ProProfile` | sensor | Everything firmware-specific: entity ids, capabilities, setting bindings, live position feeds, limits. |
| `S1ProSensor` | sensor | The model of one sensor: queries, commands and observer notifications. |
| `Zone`, `Polygon` | sensor | Zones 1–3 plus the exclusion zone; immutable, validated outlines. |
| `ValueTracker` | sensor | Last value per key; the first value after a reconnect never fires flows. |
| `EsphomeEntities` | esphome | The entity port: object ids, cached values and typed commands on the library's session. |
| `SensyBrandProfile` | homey | Which entities `homey-esphomedriver` maps onto capabilities. |
| `FlowCards` | homey | Registers conditions and actions; translates domain events into triggers. |
| `SensorPresenter` | homey | The JSON shapes for the web API and realtime updates. |

Object ids are the ones `aioesphomeapi` reports. For names with non-ASCII characters they differ from
other ESPHome clients (`SCD40 CO₂ Concentration` is `scd40_co__concentration`).

### Web views

The widget and the zone editor share their browser modules (`RadarView`,
`ZoneEditorController`, `ApiClient`, …) in `widgets/radar/public/lib/`. Homey
serves the widget at `../widgets/radar/` relative to the settings page, so the
zone editor imports them from there. Each page has one entry module
(`widget.js`, `settings/zone-editor.js`); a small inline script turns Homey's
`onHomeyReady` callback into a promise the module can await.

### Adding a sensor reading

1. Add the entity to `S1ProProfile.CAPABILITIES`, with `None` to keep the capability the library picks,
   or a capability id to remap it.
2. For a custom capability, add it under `.homeycompose/capabilities/` and to the `capabilities`
   list in `drivers/s1pro/driver.compose.json`.

### Adding a flow trigger

1. Declare the card in `drivers/s1pro/driver.flow.compose.json`.
2. Add a domain event (or reuse one) in `lib/sensor/events.py` that `S1ProSensor` raises.
3. Map it in `FlowCards.translate` and add the card id to `Cards`.

## Code style

Ruff and Pyright enforce the style (`ruff check --fix . && ruff format .` fixes most of it). The short version:

- Classes with type hints and docstrings; collaborators are injected, protocols describe the ports.
- Readability over brevity: one statement per line, no one-line `if x: return`, written-out loops
  where a dense comprehension would hide the intent, blank lines before `return`.
- New behaviour comes with tests in `tests/`. Coverage must stay above 85%.

The browser code follows the ESLint rules in `eslint.config.js` (`npm run lint:fix`).

## Pull requests

- Keep a pull request focused on one change.
- Describe what you tested, and on which firmware and Homey version.
- Add an entry to `CHANGELOG.md` under *Unreleased*.
