# This website (/docs/developers/website)



This website is built with [Fumadocs](https://fumadocs.dev/) on Next.js, with the shadcn theme, and exported as a
static site. Everything lives in `website/`:

| Path                         | Contents                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `content/docs/(guide)/`      | The user documentation (MDX); `meta.json` sets the order and the sidebar groups |
| `content/docs/developers/`   | The developer documentation, a separate sidebar tab                             |
| `app/(home)/page.tsx`        | The landing page                                                                |
| `components/`                | Extra MDX components: `ThemedImage`, `Mermaid`                                  |
| `public/images/`             | Images; the radar images are rendered with the app's own `RadarView`            |
| `scripts/sync-changelog.mjs` | Copies `../CHANGELOG.md` into the changelog page before every build             |

## Working locally [#working-locally]

```bash
cd website
npm install
npm run dev       # http://localhost:3000
npm run build     # static export to website/out
```

## Writing pages [#writing-pages]

Pages are MDX with front matter (`title`, `description`). Besides Markdown you can use:

| Component                                   | Use                                                             |
| ------------------------------------------- | --------------------------------------------------------------- |
| `<Callout type="info" title="…">`           | Notes and warnings (`info`, `warn`, `error`, `idea`, `success`) |
| `<Tabs items={[…]}>` with `<Tab value="…">` | Alternatives, such as App Store or CLI                          |
| `<Accordions>` with `<Accordion title="…">` | Recipes and FAQ                                                 |
| `<Steps>` with `<Step>`                     | Step-by-step instructions                                       |
| `<Cards>` with `<Card title href>`          | Link grids                                                      |
| `<ThemedImage light dark alt>`              | An image from `public/` with a light and a dark variant         |
| `<Mermaid chart={…} />`                     | Diagrams                                                        |

Link to other pages by their route (`/docs/zones`, `/docs/reference/flow-cards`). In MDX, `{`, `}` and `<` in plain
text must be escaped (`\{`, `&lt;`); inside code they are fine.

The changelog page is generated: edit `CHANGELOG.md` in the repository root.

## Publishing [#publishing]

`.github/workflows/docs.yml` runs on pushes to `main` that touch `website/` or the changelog. It builds the site with
`NEXT_PUBLIC_BASE_PATH=/homey-sensy-s1pro` (GitHub Pages serves it from that sub path) and publishes `website/out`
to the `gh-pages` branch, which GitHub Pages serves at
[starredev.github.io/homey-sensy-s1pro](https://starredev.github.io/homey-sensy-s1pro/).

On Windows with Git Bash, set `MSYS_NO_PATHCONV=1` when you build with a base path, or Git Bash turns
`/homey-sensy-s1pro` into a Windows path.

## Keeping the reference in sync [#keeping-the-reference-in-sync]

`reference/flow-cards`, `reference/settings` and `reference/entities` mirror `driver.flow.compose.json`,
`driver.settings.compose.json` and the sensor's entity list; update them together with those files.
