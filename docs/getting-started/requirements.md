# Requirements

## Homey

| | Supported |
|---|---|
| **Homey Pro (2023)** | Yes |
| **Homey Pro mini** | Yes |
| **Homey firmware** | 13.0 or newer |
| Homey Pro (Early 2019) and older | No: the app is a Python app, which needs the newer Homey platforms |
| Homey Cloud | No: the app talks to the sensor on your local network |

## Sensor

- A **Sensy-One S1 Pro Multi Sense** (the ESP32-C3 based S1 Pro).
- The **official Sensy-One firmware**, v1.2.21 or newer. The app finds the sensor by its ESPHome project name,
  `Sensy-One.S1 Pro Multi Sense`, so keep that unchanged if you build your own firmware.
- The sensor connected to your WiFi. Sensy-One's own setup (the onboarding through its web page) takes care of
  that.

!!! tip "Custom firmware"
    Firmware that keeps the official entity names works as well. The app also understands the live target
    entities of the earlier "Homey edition" firmware (`live_t1_x` and so on). Features that need entities a
    custom build left out (for example the air quality class) simply stay empty.

## Network

- Homey and the sensor must be able to reach each other on **TCP port 6053** (the ESPHome native API).
- Automatic discovery uses **mDNS** (`_esphomelib._tcp`). mDNS does not cross networks or VLANs. If the sensor
  lives on a separate IoT network, add it [by IP address](pairing.md#adding-by-ip-address) and give it a fixed
  IP address (a DHCP reservation in your router).
- An **API encryption key** on the sensor is supported; Homey asks for it while adding the sensor.
- For the [firmware notice](../guide/maintenance.md#firmware-updates), Homey needs internet access to
  `github.com`. Everything else stays on your local network.

## Bluetooth proxy

The official firmware has a Bluetooth proxy for Home Assistant (**BLE | Proxy** on the sensor's web page). It is
off by default. Leave it off: the ESP32-C3 has a single radio for WiFi and Bluetooth, and with the proxy on the
connection to Homey drops regularly. The app shows a warning on the device while the proxy is on.
