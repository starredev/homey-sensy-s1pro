# Zones (/docs/zones)



Zones split a room into areas: the sofa, the desk, the bed, the bath. Each zone reports its own presence,
movement and people count, has its own [flow cards](/docs/flows) and its own settings. The S1 Pro stores up to
**three detection zones** and one **exclusion zone** in the sensor itself, so they keep working when Homey
restarts.

## Opening the zone editor [#opening-the-zone-editor]

**Settings → Apps → Sensy S1 Pro → Configure** (or *App settings* in the Homey web app).

At the top you choose the zone: **1**, **2**, **3** or **Exclusion**. With more than one sensor, a list lets you
choose the sensor first.

The map is a top-down view of what the radar sees: the sensor sits at the bottom centre, the field of view fans
out upwards, and grid lines mark the distance (every metre, or every two metres for a large detection range). People show up as numbered dots that move live while you walk
around (see the [radar widget markers](/docs/widget#markers)). Next to the zone tabs, a live label says who is
there: *Nobody present*, *1 present* or *1 present · moving*.

<ThemedImage light="/images/radar-zones-light.svg" dark="/images/radar-zones-dark.svg" alt="The zone editor drawing zone 2 next to zone 1" />

## Drawing a zone [#drawing-a-zone]

1. Choose the zone tab.
2. **Tap the map** to place a corner point. Place **3 to 8** points; the outline closes by itself.
3. **Drag** a point to move it.
4. **Undo point** removes the last point; **Clear zone** removes all points.
5. **Save** writes the zone to the sensor.

The status line tells you where you are: *2 more point(s) needed*, *5 points · not saved*, *Zone saved to the
sensor*. If you switch to another zone with unsaved changes, the editor asks first.

<Callout type="idea" title="Walk the zone">
  Stand in each corner of the area you want, look where your dot is on the map, and tap there. That is the
  most reliable way to match zones to the real room.
</Callout>

After saving, the zone's capabilities (*Zone N presence*, *Zone N movement*, *People in zone N*) appear on the
device within a few seconds. Clearing a zone and saving removes them again.

## Zone settings [#zone-settings]

Below the map, **Settings for this zone** has the zone's own:

| Setting                       | What it does                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------- |
| **Presence hold time (s)**    | How long the zone stays occupied after the last detection inside it (0–3600 s). |
| **Movement threshold (cm/s)** | The minimum speed that counts as movement inside the zone (0–5000 cm/s).        |

Choose **Save settings** to write them. The same values are in the [device settings](/docs/settings#zone-1-zone-2-zone-3).

## The exclusion zone [#the-exclusion-zone]

The exclusion zone masks out an area: the firmware discards every radar measurement inside it, so whatever moves
there counts neither for the room nor for any zone. Use it for things that move but are not people:

* a ceiling or desk fan;
* curtains that move in a draught;
* a door to a busy hallway;
* a reflection that keeps showing up in the same place.

It has no presence of its own and no settings. On the map it is drawn in red.

## Rules and limits [#rules-and-limits]

* A zone has **0 points** (off) or **3 to 8 points**.
* Coordinates are whole centimetres within ±1800 cm.
* Only people within the detection range count, so a zone (partly) beyond it never sees anyone there.
* Zones may overlap; a person can be in several zones at once.
* While saving, the app first turns the zone off and then rewrites its points, so the sensor never evaluates a
  half-saved outline.
* Flows only fire for zones that have an outline. Values of zones that are not drawn are ignored.

## Zones from elsewhere [#zones-from-elsewhere]

Zones drawn on the sensor's own web page or by another app are the same zones: the editor shows them, and the
device gets their capabilities as soon as they appear on the sensor.
