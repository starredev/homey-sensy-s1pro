# Maintenance and firmware

## Maintenance actions

Open the device and find the maintenance actions (in the device's settings, under *Maintenance*).

### Calibrate CO₂ sensor

Sets the SCD40's CO₂ reading to **426 ppm**, the CO₂ level of outdoor air (forced recalibration).

!!! warning "Only in fresh outdoor air"
    The calibration assumes the sensor is in outdoor air **right now**. Put the sensor outside (or at a wide
    open window with a breeze) for **at least 3 minutes** first, without people breathing nearby. Calibrating
    indoors makes every later reading wrong.

Use it when the CO₂ readings have drifted, for example when they stay well above 420 ppm while the room is
thoroughly aired. The firmware does not recalibrate the sensor by itself.

### Restart sensor

Restarts the sensor's ESP32. The device is unavailable for a few seconds and reconnects by itself. Zones and
settings are kept: they are stored on the sensor.

### Restart radar

Restarts only the radar module. Use it when the radar stops reporting people while the rest of the sensor
works.

### Refresh capabilities

Rebuilds the device's capabilities from what the sensor reports. You rarely need it:

- capabilities for newly drawn zones appear by themselves;
- after an app update that adds capabilities, the device refreshes once by itself.

Use it after a firmware update that added new entities, if they do not show up. Your zone capabilities are kept.

## Firmware updates

The app checks the [Sensy-One releases on GitHub](https://github.com/sensy-one/S1-Pro-Multi-Sense/releases)
when the sensor connects and then every six hours. When a newer version than the one on your sensor is out:

- the device shows a warning: *Firmware vX is available (installed: vY). Update the sensor from its web page.*;
- the [*New firmware is available*](flows.md#when) trigger fires, once per version.

The app does **not** install updates itself. Update the sensor from its own web page:

1. Open the sensor's web page (its address is in the device settings under *Web server*, or
   `http://<sensor-ip>/`).
2. Use the firmware update there, following Sensy-One's instructions.

The warning disappears as soon as the sensor reconnects with the new version.

!!! note "Why Homey checks instead of the sensor"
    The firmware can check GitHub itself, but the HTTPS request needs a lot of memory on the ESP32-C3 and rarely
    gets an answer. Homey checks instead and only compares version numbers; nothing about your sensor is sent.

## Extra capabilities

Two switches in the device settings, under *Capabilities*, add more of the sensor's entities to the device:

=== "Show diagnostic capabilities"

    | Capability | From the sensor |
    |---|---|
    | Connectivity | ESP32 status |
    | Temperature (ESP32) | Chip temperature |
    | IP address | ESP32 IP |
    | WiFi network | ESP32 SSID |
    | WiFi strength | *Very weak* … *Very strong* |

=== "Show configuration capabilities"

    | Capability | From the sensor |
    |---|---|
    | On/off, brightness, colour, effect | The RGB status LED (WS2812) |
    | BLE proxy | Bluetooth proxy for Home Assistant (keep it off) |
    | Buzzer | The buzzer as a switch |
    | Radar Bluetooth | The radar module's own Bluetooth |

Turning a switch off removes those capabilities again. Settings that already have a place in the
[device settings](settings.md) (single target, mirrored mounting, real-time readings, holding engine, tracking
numbers, offsets, buzzer pitch and volume) and the factory reset buttons are never added as capabilities.

## Factory resets

The sensor has factory reset buttons for the ESP32, the radar and the CO₂ sensor. The app deliberately does not
offer them: one tap would wipe your sensor's WiFi, zones or calibration. Use the sensor's own web page if you
really need them.
