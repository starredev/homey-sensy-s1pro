/**
 * Copies the shared web modules (`web/shared`) into every web view that uses
 * them. Homey serves the widget and the settings page from separate folders,
 * so each needs its own copy; `web/shared` stays the single source of truth.
 *
 * Usage:
 *   node scripts/sync-web.js           copy
 *   node scripts/sync-web.js --check   fail when a copy is out of date (CI)
 */
import {
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'web', 'shared');

export const TARGETS = Object.freeze([
  path.join(ROOT, 'widgets', 'radar', 'public', 'lib'),
  path.join(ROOT, 'settings', 'lib'),
]);

const BANNER = '// Generated from web/shared by scripts/sync-web.js. Do not edit.\n';

/**
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function listFiles(directory) {
  try {
    const entries = await readdir(directory);

    return entries.filter((name) => name.endsWith('.js')).sort();
  } catch {
    return [];
  }
}

/**
 * @param {string} file
 * @returns {Promise<string>}
 */
async function expected(file) {
  const source = await readFile(path.join(SOURCE, file), 'utf8');

  return BANNER + source;
}

/**
 * @returns {Promise<string[]>} human-readable differences
 */
export async function findDrift() {
  const files = await listFiles(SOURCE);
  const problems = [];

  for (const target of TARGETS) {
    const present = await listFiles(target);

    if (present.join() !== files.join()) {
      problems.push(`${path.relative(ROOT, target)}: files differ from web/shared`);
      continue;
    }

    for (const file of files) {
      const actual = await readFile(path.join(target, file), 'utf8');

      if (actual !== await expected(file)) {
        problems.push(`${path.relative(ROOT, path.join(target, file))} is out of date`);
      }
    }
  }

  return problems;
}

async function sync() {
  const files = await listFiles(SOURCE);

  for (const target of TARGETS) {
    await rm(target, { recursive: true, force: true });
    await mkdir(target, { recursive: true });

    for (const file of files) {
      await writeFile(path.join(target, file), await expected(file));
    }
  }
}

async function main() {
  if (process.argv.includes('--check')) {
    const problems = await findDrift();

    for (const problem of problems) {
      process.stderr.write(`${problem}\n`);
    }

    if (problems.length > 0) {
      process.exitCode = 1;
    }

    return;
  }

  await sync();
  process.stdout.write(`Synced web/shared into ${TARGETS.length} web views\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
