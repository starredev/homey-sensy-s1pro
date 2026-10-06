# Developers (/docs/developers)



The app is open source under the MIT licence:
[github.com/starredev/homey-sensy-s1pro](https://github.com/starredev/homey-sensy-s1pro). Bug reports, tested
sensor setups and pull requests are welcome.

| Page                                                  | Contents                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| [Architecture](/docs/developers/architecture)         | Layers, the main classes and how data flows                              |
| [homey-esphomedriver](/docs/developers/esphomedriver) | What the shared ESPHome library does and how this app builds on it       |
| [Development setup](/docs/developers/development)     | Tools, running the app on your Homey, Windows notes                      |
| [Testing and CI](/docs/developers/testing)            | Test suites, coverage, linting, type checking and the CI workflows       |
| [Releasing](/docs/developers/releasing)               | Versions, changelog, publishing to the Homey App Store, library upgrades |
| [Documentation site](/docs/developers/website)        | Working on this site                                                     |

## At a glance [#at-a-glance]

* **Homey Python app** (Python 3.14, Homey SDK v3, Homey 13+), id `io.github.starredev.sensy`.
* Built on [`homey-esphomedriver`](https://github.com/Doekse/homey-esphomedriver) and
  [`aioesphomeapi`](https://github.com/esphome/aioesphomeapi).
* The **web views** (radar widget, zone editor) are plain JavaScript ES modules with their own Node tooling.
* Quality gates: ruff, pyright (strict for `lib/`), pytest with ≥ 85 % coverage, ESLint and node:test for the
  web views, and `homey app validate --level publish`.
* The previous Node.js implementation is kept on the
  [`node`](https://github.com/starredev/homey-sensy-s1pro/tree/node) branch (tag `node-1.0.0`).
