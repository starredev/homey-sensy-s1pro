# Changelog

All notable changes to this app are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the app uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - unreleased

### Added

- S1 Pro Multi Sense device, discovered through mDNS and followed when its IP address changes.
- Presence, movement and people count; temperature, humidity, pressure, IAQ, CO₂, light and UV.
- Up to three zones with presence, movement and people sub-capabilities, shown only for zones that have an outline.
- Flow cards: seven triggers, four conditions and two actions.
- Device settings that stay in sync with the sensor in both directions.
- Zone editor on the app settings page and the *Sensy radar* dashboard widget.
- Works with the official Sensy-One firmware as well as the Homey edition; live target positions are read from whichever the sensor provides.
- Adding a sensor by IP address or host name when mDNS discovery finds nothing.
- A device warning when the sensor's BLE proxy is switched on, since it makes the WiFi connection unstable and Homey does not use it.

### Changed

- App id is `io.github.starredev.sensys1pro` (was `nl.bryan.sensys1pro` during development).
- Rewritten as layered, test-covered ES modules; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
