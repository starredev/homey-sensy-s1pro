# Releasing (/docs/developers/releasing)



## Versions and changelog [#versions-and-changelog]

The app uses [semantic versioning](https://semver.org/). For every release:

1. Update `CHANGELOG.md` (move *Unreleased* to the new version).
2. Add the user-facing changelog for the App Store to `.homeychangelog.json`, in English and Dutch.
3. Bump the version: `homey app version patch` (or `minor`, `major`). This updates `.homeycompose/app.json` and
   `app.json`.
4. Commit and push; wait for CI to pass.

## Publishing to the Homey App Store [#publishing-to-the-homey-app-store]

```bash
HOMEY_HEADLESS=1 homey app publish
```

`HOMEY_HEADLESS=1` skips the interactive questions: the version is not bumped and the changelog comes from
`.homeychangelog.json` (publishing fails if the current version has no entry). Without it, the CLI asks whether
to bump the version and whether you have read the
[App Store guidelines](https://apps.developer.homey.app/app-store/guidelines).

The CLI validates the app at the *publish* level, compiles the Python dependencies for arm64 and amd64, uploads
the build and prints a link to the Developer Tools. There:

1. Open the build.
2. **Release to Test** makes it installable through the app's test link.
3. **Submit for certification** sends it to Athom for review; after approval it can be released to everyone.

The app archive is around 100 MB, because the compiled Python dependencies for both architectures are part of
it.

## Store texts and images [#store-texts-and-images]

| File                           | Used for                                   |
| ------------------------------ | ------------------------------------------ |
| `README.txt`, `README.nl.txt`  | The App Store description (English, Dutch) |
| `.homeychangelog.json`         | The *What's new* text per version          |
| `assets/images/`               | The app's store images                     |
| `drivers/s1pro/assets/images/` | The device's images                        |
| `widgets/radar/preview-*.png`  | The widget preview in light and dark mode  |

## App id [#app-id]

The app id is `io.github.starredev.sensy`. It cannot change after the first publication: a new id is a new app
for Homey, and users would have to re-add their devices.
