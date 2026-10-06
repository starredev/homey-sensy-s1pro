# Installation

=== "Homey App Store"

    1. Open the app's page in the Homey App Store (while the app is in testing, use the test link from the
       [project page](https://github.com/starredev/homey-sensy-s1pro)).
    2. Choose **Install** and pick your Homey.

    Updates arrive through the App Store like for any other app.

=== "Homey CLI (from source)"

    You need [Node.js](https://nodejs.org/) 22, the Homey CLI and
    [Docker](https://www.docker.com/products/docker-desktop/). Docker is used to compile the app's Python
    dependencies for your Homey.

    ```bash
    npm install --global homey
    git clone https://github.com/starredev/homey-sensy-s1pro.git
    cd homey-sensy-s1pro
    homey login
    homey select
    homey app install
    ```

    `homey select` lets you choose which Homey to install on. To install a newer version later, pull the latest
    code and run `homey app install` again; your devices, zones and settings are kept.

    !!! warning "Windows"
        On Windows the CLI can fail with *Error while collecting cross-compiled virtual environment* because the
        compiled dependencies contain Linux symbolic links. See
        [Development setup](../developers/development.md#windows) for the fix.

## After installing

The app appears as **Sensy S1 Pro** under **Settings → Apps**. Continue with [adding the sensor](pairing.md).

## Coming from the previous version

Earlier versions of this app were written in Node.js and had the app id `io.github.starredev.sensys1pro`. The
current app has a new id, `io.github.starredev.sensy`, so it installs **next to** the old one instead of
replacing it.

To move over:

1. Install the new app and add the sensor to it (both apps can be connected at the same time).
2. Move your flows to the new device. Two capabilities changed:

    | Old | New |
    |---|---|
    | Presence: `alarm_motion` (titled *Presence*) | `alarm_presence` |
    | Movement: `sensy_moving` | `alarm_motion` |

    The app's own flow cards (*someone entered a zone*, *the room became empty* and so on) kept their names.

3. Remove the old device and the old app.
