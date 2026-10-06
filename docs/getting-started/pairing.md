# Adding the sensor

1. In the Homey app, go to **Devices → + (add device)**.
2. Choose **Sensy S1 Pro**, then **S1 Pro Multi Sense**.
3. Homey lists the sensors it found on your network. Pick yours and continue.
4. Homey connects to the sensor, reads its entities and adds the device.

The device gets the name the sensor reports, for example *S1 Pro Multi Sense 2cd9f0*. You can rename it and move
it to a room (Homey zone) like any other device.

!!! tip "Put the device in the right room"
    Homey's zone activity uses the device's room. Move the sensor's device to the room it hangs in, so the room
    becomes active when the sensor sees someone.

## What the list shows

| Row | Meaning |
|---|---|
| A sensor name | An S1 Pro found through mDNS that is not added yet. Sensors that are already added and other ESPHome devices are not listed. |
| **Add by IP…** | Always present. Use it when your sensor is not in the list. |

## Adding by IP address

Choose **Add by IP…** when the sensor is not found automatically, for example because it is on another network or
VLAN, or because your router blocks mDNS.

1. Enter the sensor's **IP address or host name**, for example `192.168.1.40` or
   `s1-pro-multi-sense-2cd9f0.local`.
2. Leave the **port** at `6053` unless you changed it in the firmware.
3. Choose **Connect**.

You find the IP address in your router, or on the sensor's web page. Give the sensor a **fixed IP address**
(DHCP reservation) when you add it this way.

A sensor added by IP address is still recognised by its MAC address. If mDNS sees it later at another address,
Homey follows it automatically.

## Encryption key

If the sensor's firmware has an API encryption key (`api: encryption: key:` in ESPHome), Homey asks for it after
connecting. Paste the key exactly as it is in the firmware configuration. The official firmware has no key, so
normally you will not see this step.

## Errors while adding

| Message | Cause and fix |
|---|---|
| *This ESPHome project is not supported by this Homey app.* | Another ESPHome device answered at that address, or the firmware's project name is not `Sensy-One.S1 Pro Multi Sense`. |
| *Could not connect to the ESPHome device…* | Nothing answered on port 6053. Check the address, that the sensor is powered on, and that Homey can reach that network. |
| *The device did not respond in time.* | The sensor is busy or the network is slow. Try again. |
| *The encryption key is invalid.* | The key does not match the firmware's key. |
| *This device is not using encryption.* | You entered a key but the firmware has none. Leave the key empty. |
| *The device at this address is not the one Homey paired.* | During repair: another device now uses that IP address. |

## Changing the address later (repair)

If the sensor got a new IP address that Homey does not pick up by itself, or you added an encryption key to the
firmware, open the device, go to its settings and choose **Repair**. Enter the new address (and key) there; the
device, its flows and Insights are kept.

## What happens after adding

Right after adding, the app reads everything from the sensor:

- the capabilities on the device tile (see [The device](../guide/device.md));
- all [device settings](../guide/settings.md), filled with the values that are on the sensor;
- the zones that are already drawn on the sensor, which get their own capabilities a few seconds later.
