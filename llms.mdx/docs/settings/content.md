# Settings (/docs/settings)



Open the device, then the cog (**Settings**). Most settings are stored **on the sensor itself** and kept in sync
in both directions:

* Change a setting in Homey and the app writes it to the sensor right away.
* Change it somewhere else (the sensor's web page, Home Assistant, another app) and the Homey setting follows
  about a second later.

If the sensor is offline when you save, Homey shows *The sensor is not connected* and nothing is changed.

<Callout type="idea">
  The exact ranges and defaults of every setting are in the [settings reference](/docs/reference/settings).
</Callout>

## Detection [#detection]

| Setting                              | What it does                                                                                                                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Detection range** (0–1800 cm)      | How far the radar looks. People further away are ignored. Also sets the size of the radar map in the zone editor and the widget.                                                                                      |
| **Presence hold time** (0–3600 s)    | How long *Presence* stays on after the radar last detected someone. Raise it if presence drops while people sit still for a long time.                                                                                |
| **Movement threshold** (0–5000 cm/s) | The minimum speed that counts as *Motion*. Raise it if small movements (breathing, typing) should not count.                                                                                                          |
| **Track a single person**            | The radar reports at most one target. Useful in rooms where one person is expected and reflections cause [ghost targets](/docs/troubleshooting#ghost-targets). With two people in the room it still reports only one. |
| **Mirrored mounting**                | Swaps left and right, for a sensor that is mounted upside down or faces the other way. Zones and the radar map follow.                                                                                                |
| **Real-time environment readings**   | On: temperature, humidity, CO₂ and the other climate values are sent as soon as they change. Off: once a minute, which means less traffic.                                                                            |

## Zone 1, Zone 2, Zone 3 [#zone-1-zone-2-zone-3]

Each detection zone has its own:

| Setting                              | What it does                                                              |
| ------------------------------------ | ------------------------------------------------------------------------- |
| **Presence hold time** (0–3600 s)    | How long the zone's presence stays on after the last detection inside it. |
| **Movement threshold** (0–5000 cm/s) | The minimum speed that counts as movement inside the zone.                |

These are the same values you can set in the [zone editor](/docs/zones#zone-settings) and with the
[*Set zone presence hold time*](/docs/flows#then) flow card.

## Tracking [#tracking]

The official firmware has a *holding engine*: it can keep a person in place when the radar briefly loses them,
for example someone who sits very still on a sofa. These settings tune how people are tracked.

| Setting                                 | What it does                                                                                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hold people who stand still**         | Turns the holding engine on. **Off by default.** The two hold settings below only work when this is on.                                                                                                                   |
| **Stationary speed** (0–100 cm/s)       | Below this speed a person counts as standing still.                                                                                                                                                                       |
| **Hold after standing still** (0–120 s) | A person who stood still this long is *held*: their position stays even when the radar briefly loses them.                                                                                                                |
| **Hold time** (0–60 min)                | How long a held person stays when the radar no longer sees them. People who disappear at the edge of the detection area are not held.                                                                                     |
| **Jump distance** (5–300 cm)            | A new measurement further than this from a person's last position counts as a new person. Lower values reduce [ghost targets](/docs/troubleshooting#ghost-targets); too low and a quickly walking person is split in two. |

<Callout type="info" title="A living room where people watch TV">
  Turn on **Hold people who stand still**, keep **Hold after standing still** at about a minute and set
  **Hold time** to 15–30 minutes. Someone who watches a film without moving then stays present.

  People who walk out through the edge of the detection area are released straight away. If the door is in
  the middle of what the radar sees, a person who sat still before leaving can be held until the hold time
  runs out; keep the hold time short in that case.
</Callout>

The [radar widget](/docs/widget#markers) shows which people are moving, standing still or held.

## Calibration [#calibration]

| Setting                                          | What it does                                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Temperature offset** (−50 to 50 °C)            | Added to the BME688 temperature. The sensor warms up a little from its own electronics; compare with a reference thermometer and correct here. |
| **CO₂ sensor temperature offset** (−50 to 50 °C) | Temperature offset of the SCD40, which uses its temperature to compensate the CO₂ reading.                                                     |
| **Light offset** (−10000 to 10000 lx)            | Added to the light reading.                                                                                                                    |
| **UV index offset** (−50 to 50)                  | Added to the UV index.                                                                                                                         |

To calibrate the CO₂ reading itself, use the [*Calibrate CO₂ sensor*](/docs/maintenance#calibrate-co2-sensor)
maintenance action.

## Buzzer [#buzzer]

| Setting                 | What it does                                                                   |
| ----------------------- | ------------------------------------------------------------------------------ |
| **Pitch** (100–8000 Hz) | Pitch of the buzzer, for example for the [*Beep*](/docs/flows#then) flow card. |
| **Volume** (0–100 %)    | Loudness of the buzzer.                                                        |

## Device [#device]

| Setting          | What it does                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| **Device class** | The kind of device Homey treats it as. *Auto* keeps *Sensor*; there is normally no reason to change it. |

## Capabilities [#capabilities]

| Setting                             | What it does                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Show diagnostic capabilities**    | Adds diagnostic values to the tile: WiFi network, signal strength, IP address, the ESP32's temperature and its connection status.                       |
| **Show configuration capabilities** | Adds the sensor's remaining configuration entities as controls, such as the RGB LED, the radar's Bluetooth, the buzzer switch and the BLE proxy switch. |

Turning these off removes the extra values again. See
[Maintenance and firmware](/docs/maintenance#extra-capabilities) for the full list.

## Device information [#device-information]

Read-only details that come from the sensor and the connection: IP address and port, whether an encryption key
is used, manufacturer, model, MAC address, host name, ESPHome version, compilation time, project name and
version, Bluetooth MAC, the address of the sensor's web page and whether deep sleep is used.

The **Project** line shows the firmware version, for example `Sensy-One.S1 Pro Multi Sense v1.2.21`.
