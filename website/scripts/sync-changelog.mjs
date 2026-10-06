// Copies ../CHANGELOG.md into the docs, so the site and the repository share one changelog.
// The Next.js build may not read files outside this folder, hence a copy instead of an include.
import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../../CHANGELOG.md', import.meta.url);
const target = new URL('../content/docs/(guide)/changelog.mdx', import.meta.url);

const markdown = await readFile(source, 'utf8');
const body = markdown
  .replace(/^# .*\n+/, '')
  .replace(/[{}]/g, (character) => `\${character}`)
  .replace(/<(?![A-Za-z/])/g, '&lt;');

const page = `---
title: Changelog
description: All notable changes to the app.
---

{/* Generated from CHANGELOG.md by scripts/sync-changelog.mjs; edit that file instead. */}

${body}`;

await writeFile(target, page);
