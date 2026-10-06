# Troubleshooting

## The sensor is not found when adding it

Automatic discovery uses mDNS (`_esphomelib._tcp`), which does not cross networks, VLANs or some mesh WiFi
systems.

- Choose **Add by IP…** in the list and enter the sensor's address (see
  [Adding by IP address](../getting-started/pairing.md#adding-by-ip-address)).
- Give the sensor a fixed IP address with a DHCP reservation in your router.
- Make sure Homey can reach the sensor on TCP port 6053 (firewall rules between VLANs).
- Check that the sensor runs the official firmware: other ESPHome devices are not listed.

## The device keeps going offline

1. **Is the Bluetooth proxy on?** The device shows a warning when it is. Turn off **BLE | Proxy** on the
   sensor's web page. On the ESP32-C3, Bluetooth and WiFi share one radio, and with the proxy on the connection
   drops every few minutes.
2. **WiFi signal.** Turn on [*Show diagnostic capabilities*](maintenance.md#extra-capabilities) and look at
   *WiFi strength*. *Weak* or *Very weak* means the sensor needs a better spot or an access point closer by.
3. **Power.** Use a decent USB power supply; a weak supply makes the ESP32 restart under load.
4. **IP address changes.** Homey follows the sensor through mDNS. If mDNS does not work on your network, give
   the sensor a fixed IP address and use [Repair](../getting-started/pairing.md#changing-the-address-later-repair).

## Ghost targets

*The radar sees two people while I am alone*, or a second person that moves along with you.

The app shows exactly what the radar reports. Two common causes:

**A real second target.** Pets are moving targets too. A cat walking through or lying on a chair shows up as a
person.

**Reflections (multipath).** Radar signals bounce off hard, flat surfaces such as mirrors, glass, tiles and
metal. The radar then sees you twice: once where you are, and once as a "mirror image" that moves along with
you, often in the opposite direction. Bathrooms are the classic case.

What helps, in this order:

1. **[Track a single person](settings.md#detection)** in rooms where one person is expected, such as a bathroom.
   The mirror image disappears.
2. **Point the sensor differently**, so it does not look straight at a mirror or glass wall.
3. **Lower the [jump distance](settings.md#tracking)** (for example to 60 cm), so a reflection that appears
   somewhere else is less likely to be taken for the same person.
4. **An [exclusion zone](zones.md#the-exclusion-zone)** helps when the ghost always appears in the same place
   (a mirror, a window). It does not help against a ghost that moves along with you.

## Presence turns off while someone sits still

- Raise the [**presence hold time**](settings.md#detection), for the room and for the zone in question.
- Turn on [**Hold people who stand still**](settings.md#tracking) and set a longer **hold time**.
- Check that the person is within the detection range and not in the exclusion zone.

## Presence stays on in an empty room

- Look at the [zone editor](zones.md) or the [widget](widget.md): is there a marker where nobody is? Then
  something moves there (a fan, curtains, a plant near a heater) or a reflection shows up: cover it with an
  exclusion zone.
- A faded, dashed marker is a **held** person. Lower the [hold time](settings.md#tracking), or turn the holding
  engine off.
- Lower the presence hold time if it is very long.

## Zone capabilities are missing

They appear a few seconds after you save a zone with **at least three points** in the zone editor. If the
sensor was offline at that moment, they appear when it reconnects. *Refresh capabilities* keeps them.

## Settings do not stick

If a setting jumps back after you saved it, the sensor was probably offline: Homey then shows *The sensor is not
connected* and changes nothing. Settings changed on the sensor's own web page show up in Homey after about a
second; that is the sync working, not an error.

## CO₂ readings look wrong

- Right after a restart the SCD40 needs a few minutes to settle.
- If readings have drifted, [calibrate the CO₂ sensor](maintenance.md#calibrate-co2-sensor), outdoors.

## Air quality stays "Good" while it smells

The IAQ, the class and VOC are only reliable once the [calibration](air-quality.md#calibration) shows
*Calibrated*, which can take a few days. CO₂ (from the SCD40) is reliable from the start.

## Getting help

Open an issue on [GitHub](https://github.com/starredev/homey-sensy-s1pro/issues) and include:

- the app version (Settings → Apps → Sensy S1 Pro) and your Homey model and firmware;
- the sensor firmware (the device setting *Project*);
- what you expected and what happened.

A diagnostics report helps a lot: **Settings → Apps → Sensy S1 Pro → Send diagnostics report**, then mention the
code it shows in the issue.
