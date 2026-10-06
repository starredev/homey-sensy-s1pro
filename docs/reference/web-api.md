# Web API

The app has a small HTTP API and three realtime events. The radar widget and the zone editor use them; you can use
them too, for example from another Homey app or a script with a Homey API token.

App API paths are relative to `/api/app/io.github.starredev.sensy`.

## Endpoints

### `GET /devices`

Lists the S1 Pro devices of the app.

```json
[
  { "id": "48f6ee2cd9f0", "name": "S1 Pro Multi Sense 2cd9f0", "connected": true }
]
```

`id` is the sensor's MAC address (lower case, no separators); it is also the Homey device's data id.

### `GET /devices/:id`

A full snapshot of one sensor.

```json
{
  "id": "48f6ee2cd9f0",
  "name": "S1 Pro Multi Sense 2cd9f0",
  "connected": true,
  "targets": [[-74, 209], null, null],
  "targetStates": ["stationary", null, null],
  "presence": true,
  "moving": false,
  "people": 1,
  "detectionRange": 600.0,
  "zones": {
    "1": { "points": [[-100, 100], [100, 100], [100, 300], [-100, 300]], "presenceDelay": 30.0, "movementThreshold": 0.0 },
    "2": { "points": [], "presenceDelay": 0.0, "movementThreshold": 0.0 },
    "3": { "points": [], "presenceDelay": 0.0, "movementThreshold": 0.0 },
    "exclusion": { "points": [] }
  },
  "env": { "temperature": 23.5, "humidity": 67.8, "co2": 609, "iaq": 55, "lux": 0 }
}
```

| Field | Meaning |
|---|---|
| `targets` | Three slots; `[x, y]` in cm or `null` for an empty slot. |
| `targetStates` | Per slot `moving`, `stationary`, `held` or `null`. |
| `zones` | Keyed by `1`, `2`, `3`, `exclusion`. An empty `points` list means the zone is off. |
| `env` | Current capability values; `null` while unknown. |

### `PUT /devices/:id/zones/:zone`

Writes a zone outline. `:zone` is `1`, `2`, `3` or `exclusion`.

```json
{ "points": [[-100, 100], [100, 100], [100, 300], [-100, 300]] }
```

`points` must hold 0 points (clears the zone) or 3 to 8 points. Coordinates are rounded to whole centimetres and
clamped to ±1800. The response echoes the zone and the normalised points.

### `PUT /devices/:id/zones/:zone/options`

Writes a detection zone's options (not for `exclusion`). Omitted fields are left unchanged.

```json
{ "presenceDelay": 30, "movementThreshold": 0 }
```

`presenceDelay` is clamped to 0–3600 s, `movementThreshold` to 0–5000 cm/s.

### Errors

Errors come back as an error message, for example *Sensor not found*, *Unknown zone: 4*,
*A zone needs 3 to 8 points*, *Sensor not connected (zone_1_points_count)*.

## Widget API

The radar widget has its own API endpoint, `get_state` (`GET /` with an optional `id` query parameter), called
from the widget with `Homey.api('GET', '/?id=…')`. It returns the same snapshot as `GET /devices/:id`; without
`id` it returns the first sensor (or `null` when there is none).

## Realtime events

Subscribe with `Homey.api.on(...)` in a widget or settings page.

| Event | Payload | When |
|---|---|---|
| `sensy.live` | `id`, `connected`, `targets`, `targetStates`, `presence`, `moving`, `people`, `zones` (array of `{zone, presence, movement, people}`) | When targets, presence or zone states change; at most every 200 ms per sensor |
| `sensy.zones` | A full snapshot (as `GET /devices/:id`) | When zone outlines change, about a second after the last change |
| `sensy.devices` | The device list (as `GET /devices`) | When a sensor connects or disconnects |

!!! note "Two shapes for zones"
    In a snapshot, `zones` is an object keyed by zone; in a `sensy.live` frame it is an array with one entry per
    detection zone.
