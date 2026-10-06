# Changelog

All notable changes to this app are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the app uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- The app is now a Homey Python app on top of `homey-esphomedriver` (and `aioesphomeapi`) instead of
  `@2colors/esphome-native-api`. The library takes over the connection, reconnects, pairing (mDNS and *Add by IP…*)
  and the standard capabilities; sensors with an API encryption key can now be added.
- Presence is `alarm_presence` and movement is `alarm_motion` (was `alarm_motion` and `sensy_moving`).
  Existing sensors must be removed and added again.
- Requires Homey 13.0 or newer.

### Added

- Diagnostic and configuration entities can be shown as capabilities from the device settings.
- *Refresh capabilities* maintenance action.
- Air quality class (*Excellent* … *Extremely polluted*), its calibration state and VOC as capabilities, with an
  *Air quality changed* trigger and an *Air quality is X or worse* condition.
- Tracking settings of the radar: holding people who stand still (the firmware's holding engine, off by default),
  stationary speed, hold after standing still, hold time and jump distance; light and UV offsets.
- Settings for mirrored mounting, real-time environment readings and the buzzer's pitch and volume.
- Maintenance actions: calibrate the CO₂ sensor, restart the sensor, restart the radar.
- The radar widget shows whether a person is moving, standing still or held.
- A device warning and a *New firmware is available* trigger when Sensy-One releases a newer firmware.
- Zone capabilities follow the zones drawn in the zone editor automatically.

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
- Rewritten as layered, test-covered ES modules; see [CONTRIBUTING.md](CONTRIBUTING.md).
