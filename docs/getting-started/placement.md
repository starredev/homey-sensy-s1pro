# Placing the sensor

The S1 Pro's mmWave radar sees a **fan-shaped area of about 120°** in front of the sensor. Placement decides
how well it detects people, and where your zones end up.

## The coordinate system

The app, the zone editor and the radar widget all use the radar's own coordinates, in centimetres:

```
            y (distance in front of the sensor)
            ▲
     ╲      │      ╱
      ╲     │     ╱     ← about 120° field of view
       ╲    │    ╱
        ╲   │   ╱
 ─x ◀────── ● ──────▶ +x
          sensor
```

- **x** is left (−) or right (+) as seen *from* the sensor.
- **y** is the distance straight in front of the sensor.
- The **detection range** (default 600 cm, see [settings](../guide/settings.md#detection)) limits how far the
  radar looks.

## Tips

- **Face the open room.** Mount the sensor so the area you care about is in front of it, not at the far edge of
  the field of view.
- **Avoid moving objects in view**: fans, curtains in a draught, plants near a heater, robot vacuums. Hide them
  with an [exclusion zone](../guide/zones.md#the-exclusion-zone) if you cannot avoid them.
- **Be careful with mirrors, glass and tiles.** Radar signals reflect off hard, flat surfaces. A person can then
  show up twice: once where they are and once as a "mirror image" that moves along. Bathrooms with large
  mirrors or a glass shower wall are the worst case. See [ghost targets](../guide/troubleshooting.md#ghost-targets).
- **Pets are seen too.** A cat or dog is a moving target like any other. Zones and the
  [people count condition](../guide/flows.md) help to tell a person from a pet in most rooms.
- **Upside down or facing the other way?** Turn on [*Mirrored mounting*](../guide/settings.md#detection) so left
  and right are not swapped in your zones and on the radar.

!!! note "Sensy-One's own guidance"
    For mounting height, angle and the sensor's exact range, follow the instructions that came with the sensor
    and the [Sensy-One documentation](https://github.com/sensy-one/S1-Pro-Multi-Sense).

## Checking the result

Open the [zone editor](../guide/zones.md) (**Apps → Sensy S1 Pro → Configure**) and walk around the room. You
see yourself as a dot on the radar map. If the dot follows you well everywhere you want to detect people, the
sensor is placed right.
