# Contributing

Thanks for helping out. Bug reports, tested sensor setups and pull requests are all welcome.

## Development setup

You need Node.js 22 or newer and the Homey CLI (`npm install --global homey`).
Running the app on a Homey Pro 2023 or later also needs Docker.

```bash
npm install
npm run check
```

`npm run check` runs everything CI runs: lint, type-check, the tests with
coverage thresholds and the Homey manifest validation.

To try the app on your own Homey:

```bash
homey login
homey select
homey app run
```

## How the code is organised

```
app.js  api.js  drivers/s1pro/      Homey entry points (thin adapters)
lib/homey/                          Flow cards, capabilities, settings, pairing,
                                    realtime updates and the web API service
lib/sensor/                         The S1 Pro model: zones, events, device profile
lib/esphome/                        ESPHome native API connection
lib/errors.js  timers.js  utils.js  Shared building blocks
widgets/radar/public/               Dashboard widget, plus the browser modules
                                    the zone editor reuses (lib/)
settings/                           Zone editor (app settings page)
test/                               Unit tests and test doubles (fakes.js)
```

Dependencies only point downwards in this list: `lib/sensor` and `lib/esphome`
never import from `homey`, so they run under plain `node --test`.

`app.json` is generated. Edit the files in `.homeycompose/` and `drivers/*/*.compose.json`.

### Data flow

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

Commands go the other way: a flow card, the web API or a settings change calls
the sensor (`setZoneOutline`, `setZoneOptions`, `applySettings`, `beep`), which
writes entities through the connection.

### Key types

| Type | Folder | Responsibility |
|---|---|---|
| `EsphomeConnection` | esphome | Connection lifecycle, entity cache, typed commands. The client factory is injectable. |
| `DeviceProbe` | esphome | One-shot connection that reads which device answers at an address. |
| `skipUnknownMessages` | esphome | Fix for the ESPHome client, which otherwise drops the connection on message types it does not know. |
| `S1ProProfile` | sensor | Everything firmware-specific: entity ids, capability and setting bindings, live position feeds, limits. |
| `S1ProSensor` | sensor | The model of one sensor: queries, commands and domain events. |
| `Zone`, `Polygon` | sensor | Zones 1–3 plus the exclusion zone; immutable, validated outlines. |
| `ValueTracker` | sensor | Last value per key; the first value after a reconnect never fires flows. |
| `FlowCards` | homey | Registers conditions and actions; translates domain events into triggers. |
| `S1ProPairing` | homey | Pairable devices from mDNS, or from an address the user typed. |
| `SensorPresenter` | homey | The JSON shapes for the web API and realtime updates. |

### Web views

The widget and the zone editor share their browser modules (`RadarView`,
`ZoneEditorController`, `ApiClient`, …) in `widgets/radar/public/lib/`. Homey
serves the widget at `../widgets/radar/` relative to the settings page, so the
zone editor imports them from there. Each page has one entry module
(`widget.js`, `settings/zone-editor.js`); a small inline script turns Homey's
`onHomeyReady` callback into a promise the module can await.

### Adding a sensor reading

1. Add the capability to `drivers/s1pro/driver.compose.json` (and a custom
   capability under `.homeycompose/capabilities/` if needed).
2. Add a `CapabilityBinding` to `S1ProProfile.capabilities`.

### Adding a flow trigger

1. Declare the card in `drivers/s1pro/driver.flow.compose.json`.
2. Add a domain event (or reuse one) that `S1ProSensor` emits.
3. Map it in `FlowCards.translate` and add the card id to `Cards`.

## Code style

ESLint enforces the style (`npm run lint:fix` fixes most of it). The short version:

- Modern ES modules, classes with private (`#`) members, JSDoc types on public APIs.
- Readability over brevity: every `if` gets braces on its own lines, one statement per line,
  blank lines between class members and before `return`.
- New behaviour comes with tests in `test/`. Coverage must stay above 85%.

## Pull requests

- Keep a pull request focused on one change.
- Describe what you tested, and on which firmware and Homey version.
- Add an entry to `CHANGELOG.md` under *Unreleased*.
