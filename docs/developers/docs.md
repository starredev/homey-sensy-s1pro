# Documentation site

This site is built with [MkDocs](https://www.mkdocs.org/) and
[Material for MkDocs](https://squidfunk.github.io/mkdocs-material/). The sources are in `docs/`, the configuration
in `mkdocs.yml`.

## Working locally

```bash
uv pip install -r requirements-docs.txt
mkdocs serve      # live preview on http://127.0.0.1:8000
mkdocs build --strict
```

`--strict` turns warnings (such as broken links) into errors; CI builds the site the same way.

## Publishing

`.github/workflows/docs.yml` runs on pushes to `main` that touch the docs. It builds the site with `--strict` and
publishes it with `mkdocs gh-deploy` to the `gh-pages` branch, which GitHub Pages serves at
[starredev.github.io/homey-sensy-s1pro](https://starredev.github.io/homey-sensy-s1pro/).

Pull requests only build the site, so broken links are caught before merging.

## Conventions

- Write for Homey users first in the *Getting started* and *User guide* sections; keep implementation details in
  *Developers*.
- Use the names the Homey app shows (*Presence*, *Hold time*), and the ids in `code` in the *Reference*.
- The changelog page includes `CHANGELOG.md` from the repository root, so there is one changelog.
- `reference/flow-cards.md`, `reference/settings.md` and `reference/entities.md` mirror
  `driver.flow.compose.json`, `driver.settings.compose.json` and the sensor's entity list; update them together
  with those files.
