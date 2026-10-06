<p align="center"><img src="assets/logo.png" alt="Sensy S1 Pro for Homey" width="160"></p>

# Sensy S1 Pro for Homey

[![CI](https://github.com/starredev/homey-sensy-s1pro/actions/workflows/ci.yml/badge.svg)](https://github.com/starredev/homey-sensy-s1pro/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A Homey app for the [Sensy-One S1 Pro Multi Sense](https://github.com/sensy-one/S1-Pro-Multi-Sense):
mmWave presence (including people who sit still), up to three zones, people counting and a full set of
environment sensors, straight from the sensor to Homey over the ESPHome native API. No Home Assistant
and no MQTT broker needed.

The app is a Homey **Python** app built on [`homey-esphomedriver`](https://github.com/Doekse/homey-esphomedriver),
the shared ESPHome layer that also powers the generic ESPHome app for Homey. That library handles the
connection, reconnects, encryption, pairing and the standard capabilities; this app adds what is specific to
the S1 Pro: zones, live targets, flow cards, settings, the zone editor and the radar widget.

> **Unofficial community project.** Not made, endorsed or supported by Sensy-One.

## Features

**Device** — found automatically on your network (mDNS) and followed when its IP address changes. If it is not found,
for example because it is on a separate IoT network, choose *Add by IP…* instead. Sensors with an API encryption key
are supported too.

| Capability | Source |
|---|---|
| Presence (`alarm_presence`), movement (`alarm_motion`), number of people | mmWave radar |
| Temperature, humidity, pressure, air quality (IAQ index, class and calibration state), VOC | BME688 |
| CO₂ | SCD40 |
| Light (lux), UV index | LTR390 |
| Per zone: presence, movement, people | Radar zones (only shown for zones you have drawn) |

**Flow cards**

- *When:* someone became present · the room became empty · the number of people changed · the air quality changed ·
  new firmware is available ·
  someone entered zone X · zone X became empty · movement started / stopped in zone X
- *And:* someone is present · zone X is occupied · there is movement in zone X · the number of people is above N ·
  the air quality is X or worse
- *Then:* set the presence hold time of zone X · beep

**Zone editor** (*Apps → Sensy S1 Pro → Configure*) — watch people move live, tap to place 3–8 corner
points, drag them, save. Three zones plus an exclusion zone, each with its own hold time and movement threshold.

**Dashboard widget** — a top-down radar with people as moving dots and zones that light up on presence. A person
who stands still gets a dashed ring; a person the radar is holding is drawn faded.

**Device settings** — detection range, hold times, movement thresholds, single-target mode, mirrored mounting,
real-time or once-a-minute environment readings, the radar's tracking (holding people who stand still, when a
person counts as standing still, how long a still person is held, the jump distance that separates two people),
temperature, light and UV offsets and the buzzer's pitch and volume, kept in sync with the sensor in both directions.

**Maintenance actions** — calibrate the CO₂ sensor (after a few minutes in outdoor air), restart the sensor or the radar.

**Firmware** — Homey checks the Sensy-One releases every six hours and shows a warning on the device (plus a flow
trigger) when a newer firmware is out. Updating itself is done from the sensor's web page. Diagnostic and configuration entities
(WiFi details, LED, restart buttons, radar switches) can be shown as extra capabilities from the device settings.

## Requirements

- A Sensy-One **S1 Pro Multi Sense** with the official firmware (v1.2.21 or newer) or the Homey edition
  firmware. The app finds the sensor through mDNS by its ESPHome project name, so keep that unchanged.
- Homey Pro (2023) or Homey Pro mini with firmware **13.0 or newer** (Python apps).

## Installation

Until the app is in the Homey App Store, install it with the Homey CLI (needs Docker, which compiles the
Python dependencies for your Homey):

```bash
homey login
homey select
homey app install
```

Then add the sensor: **Devices → + → Sensy S1 Pro → S1 Pro Multi Sense**.

## Troubleshooting

- **The sensor keeps going offline.** Check that *BLE | Proxy* is off on the sensor's web page (`http://<sensor-ip>`).
  The proxy is only for Home Assistant; on the single-radio ESP32-C3 it competes with WiFi. The app shows a warning
  on the device while the proxy is on.
- **The sensor is not found when adding it.** The app finds sensors through mDNS (`_esphomelib._tcp`), which does not
  cross networks or VLANs. Choose *Add by IP…* in the list and give the sensor a fixed IP address (DHCP reservation).
- **Zone capabilities missing.** They appear a few seconds after you save a zone with at least three points
  in the zone editor; *Refresh capabilities* keeps them.

## Development

```bash
uv venv --python 3.14 && uv pip install -r requirements-dev.txt
ruff check . && ruff format --check . && pyright && pytest --cov   # the app (Python)
npm install && npm run check                                       # the web views (JavaScript)
homey app validate --level publish                                 # the manifest (needs Docker)
homey app run                                                      # run on your Homey (needs Docker)
```

The code is organised in layers (entity port → sensor model → Homey adapters), with the sensor
logic free of Homey so it runs under plain `pytest`. [CONTRIBUTING.md](CONTRIBUTING.md) explains the
structure and the code style.

## Credits

- [Sensy-One](https://github.com/sensy-one) for the S1 Pro hardware and its ESPHome firmware.
- [`homey-esphomedriver`](https://github.com/Doekse/homey-esphomedriver) by Abe Haverkamp and
  [`aioesphomeapi`](https://github.com/esphome/aioesphomeapi) for the ESPHome integration.

## License

[MIT](LICENSE) © 2026 Bryan. The Sensy-One firmware is not part of this repository and has its own license.
