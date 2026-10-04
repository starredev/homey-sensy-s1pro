# Contributing

Thanks for helping out. Bug reports, tested sensor setups and pull requests are all welcome.

## Development setup

You need Node.js 22 or newer and the Homey CLI (`npm install --global homey`).
Running the app on a Homey Pro 2023 or later also needs Docker.

```bash
npm install
npm run check
```

`npm run check` runs everything CI runs: lint, type-check, the web-module sync
check, the tests with coverage thresholds and the Homey manifest validation.

To try the app on your own Homey:

```bash
homey login
homey select
homey app run
```

## Where things live

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the layers and the data flow.

- `app.json` is generated. Edit the files in `.homeycompose/` and `drivers/*/*.compose.json`.
- Browser code shared by the widget and the zone editor lives in `web/shared/`.
  Run `npm run sync:web` after changing it; never edit the copies in `lib/` folders of the web views.

## Code style

ESLint enforces the style (`npm run lint:fix` fixes most of it). The short version:

- Modern ES modules, classes with private (`#`) members, JSDoc types on public APIs.
- Readability over brevity: every `if` gets braces on its own lines, one statement per line,
  blank lines between class members and before `return`.
- Domain code (`lib/core`, `lib/domain`, `lib/sensor`) must not import from `homey`.
- New behaviour comes with tests under `test/unit/`. Coverage must stay above 85%.

## Pull requests

- Keep a pull request focused on one change.
- Describe what you tested, and on which firmware and Homey version.
- Add an entry to `CHANGELOG.md` under *Unreleased*.
