# Architecture

The app is split into layers with a strict dependency direction: outer layers
know inner layers, never the other way around. Everything below `lib/homey`
runs without Homey, which is what makes it unit-testable.

```
drivers/  app.js  api.js            Homey entry points (thin adapters)
   │
lib/homey/                          Homey adapters: flow cards, capabilities,
   │                                settings, realtime, web API service
lib/presentation/                   JSON contracts for the web views
   │
lib/sensor/                         The S1 Pro model and its device profile
   │
lib/esphome/                        ESPHome native API transport
   │
lib/domain/   lib/core/             Value objects, domain events, utilities
```

## Data flow

```
ESPHome entity state
  → EsphomeConnection      caches the value, emits `state`
  → StateRouter            routes by object id / pattern
  → S1ProSensor            tracks state, emits `capability`, `zoneStatus`,
                           `live`, `zones`, `settings` and domain events
  → S1ProDevice            CapabilityStore / ZoneCapabilities / SettingsMirror
                           FlowCards.dispatch(event)  →  trigger cards
                           RealtimeHub.live(view)     →  widget, zone editor
```

Commands go the other way: a flow card, the web API or a settings change
calls the sensor (`setZoneOutline`, `setZoneOptions`, `applySettings`,
`beep`), which writes entities through the connection.

## Key types

| Type | Layer | Responsibility |
|---|---|---|
| `Zone` | domain | Flyweight for zones 1–3 and the exclusion zone; names their entities. |
| `Polygon` | domain | Immutable, validated zone outline (empty or 3–8 points). |
| `ValueTracker` | domain | Last value per key; marks the first value after a reconnect as *initial* so it never fires flows. |
| `TargetTracker` | domain | Combines per-axis radar updates into target positions. |
| `SensorEvent` subclasses | domain | `PresenceChanged`, `PeopleCountChanged`, `ZonePresenceChanged`, `ZoneMovementChanged`. |
| `Endpoint` | esphome | Host and port value object. |
| `DeviceProbe`, `DeviceIdentity` | esphome | One-shot connection that reads which device answers at an address. |
| `EsphomeConnection` | esphome | Connection lifecycle, entity cache, typed commands. The client factory is injectable. |
| `S1ProProfile` | sensor | Everything firmware-specific: entity ids, capability and setting bindings, limits. |
| `CapabilityBinding`, `SettingBinding` | sensor | Declarative mappings; setting bindings are polymorphic (number vs switch). |
| `TargetFeed` | sensor | One per firmware variant: which entities carry live positions, how an empty slot looks and which axis completes a position. |
| `StateRouter` | sensor | Dispatches entity updates by exact id or regular expression. |
| `ZoneRepository` | sensor | Reads and writes outlines and per-zone options on the sensor. |
| `S1ProSensor` | sensor | The domain model of one sensor: queries, commands and events. |
| `SensorPresenter` | presentation | Builds the `summary`, `live` and `snapshot` payloads. |
| `FlowCards` | homey | Registers conditions and actions; translates domain events into triggers. |
| `CapabilityStore` | homey | Capability writes that skip no-ops and never throw. |
| `ZoneCapabilities` | homey | Adds and removes per-zone sub-capabilities to match the drawn zones. |
| `SettingsMirror` | homey | Two-way sync between device settings and sensor entities. |
| `RealtimeHub` | homey | Throttled realtime publishing to the web views. |
| `S1ProPairing` | homey | Pairable devices from mDNS results, or from an address the user typed (verified with `DeviceProbe`). |
| `SensyApi` | homey | Application service behind `api.js` and the widget API; validates input. |

## Web views

`web/shared/` holds the browser modules used by both the dashboard widget and
the zone editor: `RadarGeometry`, `RadarView` with its layers, `ZoneDraft`,
`ZoneEditorController`, `ApiClient` and `Translator`. Homey serves the widget
and the settings page from separate folders, so `npm run sync:web` copies the
modules into `widgets/radar/public/lib/` and `settings/lib/`. The copies are
generated; edit `web/shared/` only. CI fails when a copy is out of date.

Each page has one entry module (`widget.js`, `zone-editor.js`) with a page
class. A small inline script turns Homey's `onHomeyReady` callback into a
promise, so the module can `await window.homeyReady` regardless of load order.

## Adding a sensor reading

1. Add the capability to `drivers/s1pro/driver.compose.json` (and a custom
   capability under `.homeycompose/capabilities/` if needed).
2. Add a `CapabilityBinding` to `S1ProProfile.capabilities`.

## Adding a flow trigger

1. Declare the card in `drivers/s1pro/driver.flow.compose.json`.
2. Add a domain event (or reuse one) that `S1ProSensor` emits.
3. Map it in `FlowCards.translate` and add the card id to `Cards`.
