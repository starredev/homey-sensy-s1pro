# FAQ

**Does the app need the internet or a cloud?**
:   No. Homey talks to the sensor on your local network. The only outbound request is a version check against
    Sensy-One's GitHub releases page every six hours, for the [firmware notice](maintenance.md#firmware-updates).

**Do I need Home Assistant or MQTT?**
:   No. The app uses the ESPHome native API directly.

**Can I use the sensor in Home Assistant at the same time?**
:   Yes. The native API accepts several clients at once. Settings and zones changed in Home Assistant show up in
    Homey (and the other way round).

**How many people can it count?**
:   Up to three at a time; that is the limit of the radar.

**Does it detect people who sit or lie still?**
:   Yes. That is what mmWave radar is good at. Tune the [hold times and the tracking](settings.md#tracking) for
    rooms where people stay still for a long time, such as a living room or bedroom.

**Does it see through walls?**
:   Radar passes through thin, non-metallic materials such as drywall or a wooden door to some extent. Limit the
    [detection range](settings.md#detection) and use an [exclusion zone](zones.md#the-exclusion-zone) if it picks
    up movement in the next room.

**Can it tell people from pets?**
:   Not reliably; a cat or dog is a moving target too, and the radar only sees positions on the floor plan, not
    height. Zones and the people count often help, for example by only reacting to the sofa zone.

**Where are my zones stored?**
:   On the sensor itself. They survive a Homey restart, an app reinstall and re-adding the device.

**Why does the device show *Presence* and *Motion* as separate values?**
:   *Presence* means someone is there (also when still); *Motion* means someone moves. Use *Presence* for lights
    and heating, *Motion* for things that should react to activity.

**Can the app update the sensor's firmware?**
:   No; it tells you when there is an update. Install it from the sensor's web page.

**What about the RGB light on the sensor?**
:   The firmware only uses it during first-time setup. You can control it from Homey after turning on
    [*Show configuration capabilities*](maintenance.md#extra-capabilities).

**I moved from the previous (Node.js) app. What changed?**
:   See [Coming from the previous version](../getting-started/installation.md#coming-from-the-previous-version).

**Is this an official Sensy-One app?**
:   No. It is an unofficial community project, open source under the MIT licence.
