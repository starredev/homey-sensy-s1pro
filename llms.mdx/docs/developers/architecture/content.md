# Architecture (/docs/developers/architecture)



## Repository layout [#repository-layout]

```
app.py  api.py  drivers/s1pro/       Homey entry points (thin adapters)
lib/homey/                           Brand profile, flow cards, zone capabilities, settings mirror,
                                     realtime hub, web API service, firmware catalog, warnings
lib/esphome/                         The entity port on top of the homey-esphomedriver session
lib/sensor/                          The S1 Pro model: zones, targets, events, air quality, firmware profile
lib/errors.py  timers.py  utils.py   Shared building blocks
widgets/radar/                       Dashboard widget: api.py, plus the browser modules the
                                     zone editor reuses (public/lib/)
settings/                            Zone editor (app settings page)
tests/                               Python tests and test doubles (fakes.py)
test/                                Tests of the browser modules (node:test)
docs/                                This documentation site
```

`app.json` is generated from `.homeycompose/` and `drivers/*/*.compose.json`; never edit it by hand.

## Layers [#layers]

Imports only point downwards:

<Mermaid
  chart="`flowchart TB
  E[&#x22;Entry points<br/>app.py · api.py · drivers/s1pro/*.py · widgets/radar/api.py&#x22;]
  H[&#x22;lib/homey<br/>brand profile · flow cards · zone capabilities · settings mirror<br/>realtime hub · web API · firmware · warnings&#x22;]
  S[&#x22;lib/sensor<br/>S1ProSensor · profile · zones · polygons · targets · events · air quality&#x22;]
  P[&#x22;lib/esphome<br/>EsphomeEntities (entity port)&#x22;]
  B[&#x22;lib/errors · timers · utils&#x22;]
  E --> H --> S --> B
  E --> P --> S`"
/>

* `lib/sensor` never imports `homey`, the ESPHome client or `homey-esphomedriver`. It talks to the sensor
  through the `EntityPort` protocol and reports through the `SensorObserver` protocol, so it runs under plain
  pytest with fakes.
* `lib/esphome` implements the `EntityPort` on top of the library's Native API session.
* `lib/homey` adapts the model to Homey: capabilities, flows, settings, realtime events and the web API.
* The entry points are thin. They wire the pieces together and contain no domain logic.

<Callout type="warn" title="Relative imports">
  The Homey Python runtime loads the app as the package `app` (`app.app`, `app.drivers.s1pro.device`,
  `app.widgets.radar.api`), so `lib` is never a top-level module at runtime. All app code imports itself
  relatively (`from ...lib.sensor.zone import Zone`). A test guards this.
</Callout>

## Main classes [#main-classes]

| Class                          | Module                           | Responsibility                                                                                                                         |
| ------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `S1ProProfile`                 | `lib/sensor/profile.py`          | Everything firmware-specific: entity ids, which entities become capabilities, setting bindings, target feeds, limits.                  |
| `S1ProSensor`                  | `lib/sensor/sensor.py`           | The model of one sensor: queries (presence, zones, targets, air quality), commands (zones, settings, beep) and observer notifications. |
| `Zone`, `Polygon`              | `lib/sensor/`                    | Zones 1–3 and the exclusion zone; immutable, validated outlines.                                                                       |
| `TargetTracker`, `TargetState` | `lib/sensor/target_tracker.py`   | Assembles per-axis updates into positions; tracks moving/stationary/held per slot.                                                     |
| `ValueTracker`                 | `lib/sensor/value_tracker.py`    | Last value per key; the first value after a reconnect never fires flows.                                                               |
| `StateRouter`                  | `lib/sensor/state_router.py`     | Routes entity states by exact id or pattern.                                                                                           |
| `ZoneRepository`               | `lib/sensor/zone_repository.py`  | Reads and writes zone outlines and options through the port.                                                                           |
| `EsphomeEntities`              | `lib/esphome/entities.py`        | The entity port: second state subscription, value cache by object id, typed commands, disconnect detection.                            |
| `SensyBrandProfile`            | `lib/homey/brand_profile.py`     | Tells the library which entities become capabilities, per device (drawn zones), plus maintenance buttons.                              |
| `ZoneCapabilities`             | `lib/homey/zone_capabilities.py` | Which zone capabilities a device should have, given its drawn zones.                                                                   |
| `SettingsMirror`               | `lib/homey/settings_mirror.py`   | Two-way sync between device settings and sensor entities.                                                                              |
| `FlowCards`                    | `lib/homey/flow_cards.py`        | Registers conditions and actions; translates domain events into triggers.                                                              |
| `SensorPresenter`              | `lib/homey/presenter.py`         | The JSON shapes of the web API and realtime events.                                                                                    |
| `RealtimeHub`                  | `lib/homey/realtime_hub.py`      | Publishes realtime events; throttles live frames per sensor.                                                                           |
| `FirmwareCatalog`              | `lib/homey/firmware.py`          | Latest official release from GitHub, cached for six hours.                                                                             |
| `DeviceWarnings`               | `lib/homey/warnings.py`          | Combines several warnings into Homey's single device warning.                                                                          |

## Data flow [#data-flow]

<Mermaid
  chart="`sequenceDiagram
  participant FW as S1 Pro firmware
  participant L as homey-esphomedriver
  participant E as EsphomeEntities
  participant M as S1ProSensor
  participant D as S1ProDevice
  participant H as Homey

  FW->>L: entity states (native API)
  L->>H: standard capabilities (presence, climate, zones of drawn zones…)
  FW->>E: same states (second subscription)
  E->>M: on_entity_state(object_id, value)
  M->>D: SensorObserver: live, zones changed, settings changed, events
  D->>H: flow triggers, settings, realtime events, warnings`"
/>

Commands go the other way: a flow card, the web API or a settings change calls the model
(`set_zone_outline`, `set_zone_options`, `apply_settings`, `beep`), which writes entities through the port.
Maintenance buttons are pressed by the library itself.

## Notable design decisions [#notable-design-decisions]

**Capabilities are owned by the library.** All capabilities, including the per-zone ones, are mapped by
`homey-esphomedriver`. The app only decides *which* through its brand profile. That keeps
*Refresh capabilities* working without special cases. See [homey-esphomedriver](/docs/developers/esphomedriver).

**Zones follow the drawn outlines.** Whether a zone exists is the *value* of `zone_N_points_count`, which the
library's pair-time mapping never sees. The device stores its drawn zones and returns a per-device brand profile
(`SensyBrandProfile.with_zones`). When the outlines change, it presses the library's own refresh action.

**Settings live on the sensor.** The sensor is the source of truth. Homey settings mirror it both ways, debounced
by a second, so settings changed in other tools show up in Homey.

**No flows from re-sent values.** After every (re)connect the `ValueTracker` forgets which values it has seen;
the first value of every entity is then *initial* and never fires a trigger.

**Firmware differences live in the profile.** The official firmware reports target positions on every radar
frame as `target_N_x`/`target_N_y` (with `(0, 0)` for an empty slot, completed by `y`); the older Homey edition
sent `live_tN_x`/`live_tN_y` only on change, with `-9999` for empty. Each is a `TargetFeed` in the profile.
