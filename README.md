# Sensy S1 Pro for Homey

[![CI](https://github.com/starredev/homey-sensy-s1pro/actions/workflows/ci.yml/badge.svg)](https://github.com/starredev/homey-sensy-s1pro/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A Homey app for the [Sensy-One S1 Pro Multi Sense](https://github.com/sensy-one/S1-Pro-Multi-Sense):
mmWave presence (including people who sit still), up to three zones, people counting and a full set of
environment sensors, straight from the sensor to Homey over the ESPHome native API. No Home Assistant
and no MQTT broker needed.

> **Unofficial community project.** Not made, endorsed or supported by Sensy-One.

## Features

**Device** — found automatically on your network (mDNS) and followed when its IP address changes. If it is not found,
for example because it is on a separate IoT network, you can add it by IP address or host name instead.

| Capability | Source |
|---|---|
| Presence (`alarm_motion`, so Homey zone activity works even when people sit still) | mmWave radar |
| Movement, number of people | mmWave radar |
| Temperature, humidity, pressure, air quality (IAQ) | BME688 |
| CO₂ | SCD40 |
| Light (lux), UV index | LTR390 |
| Per zone: presence, movement, people | Radar zones (only shown for zones you have drawn) |

**Flow cards**

- *When:* someone became present · the room became empty · the number of people changed ·
  someone entered zone X · zone X became empty · movement started / stopped in zone X
- *And:* someone is present · zone X is occupied · there is movement in zone X · the number of people is above N
- *Then:* set the presence hold time of zone X · beep

**Zone editor** (*Apps → Sensy S1 Pro → Configure*) — watch people move live, tap to place 3–8 corner
points, drag them, save. Three zones plus an exclusion zone, each with its own hold time and movement threshold.

**Dashboard widget** — a top-down radar with people as moving dots and zones that light up on presence.

**Device settings** — detection range, hold times, movement thresholds, single-target mode and
temperature offsets, kept in sync with the sensor in both directions.

## Requirements

- A Sensy-One **S1 Pro Multi Sense** with the official firmware (v1.2.21 or newer) or the Homey edition
  firmware. The app finds the sensor through mDNS by its ESPHome project name, so keep that unchanged.
- Homey Pro (2023) or Homey Pro mini with firmware **12.4 or newer**.

## Installation

Until the app is in the Homey App Store, install it with the Homey CLI:

```bash
npm install
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
  cross networks or VLANs. When nothing is found, the app asks for the sensor's IP address instead; give the sensor
  a fixed IP address (DHCP reservation) in that case.

## Development

```bash
npm install
npm run check      # lint, type-check, sync check, tests with coverage, manifest validation
npm test           # tests only
npm run sync:web   # after changing web/shared/
homey app run      # run on your Homey (needs Docker)
```

The code is organised in layers (ESPHome transport → sensor model → Homey adapters), with all domain
logic free of Homey so it runs under plain `node --test`. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the details and [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Credits

- [Sensy-One](https://github.com/sensy-one) for the S1 Pro hardware and its ESPHome firmware.
- [`@2colors/esphome-native-api`](https://www.npmjs.com/package/@2colors/esphome-native-api) for the ESPHome client.

## License

[MIT](LICENSE) © 2026 Bryan. The Sensy-One firmware is not part of this repository and has its own license.
