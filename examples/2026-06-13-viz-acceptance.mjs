// Acceptance spec for the Visualization Composition & Exploration track.
//
// Exercises the real CLI against test/fixture and checks the model's
// reference index plus the generated dashboard's composable controls.
// Sections are uncommented as their phase lands; the track is DONE when
// this file runs clean with every section active.
//
// Run: npm run build && node examples/2026-06-13-viz-acceptance.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = join(root, 'test', 'fixture');
const out = mkdtempSync(join(tmpdir(), 'cad-viz-'));

execFileSync('node', [join(root, 'dist', 'cli.js'), fixture, '-o', out], { stdio: 'inherit' });
const model = JSON.parse(readFileSync(join(out, 'model.json'), 'utf8'));
const html = readFileSync(join(out, 'index.html'), 'utf8');

// ---- Phase 1: reference index ----
assert.ok(Array.isArray(model.references));
const animalSites = model.references.filter((r) => r.to === 'src/models.ts#Animal');
assert.ok(animalSites.length >= 4, 'type used in multiple places');
assert.ok(animalSites.some((r) => r.file === 'src/app.ts')); // used outside its module
assert.equal(
  model.references.filter((r) => r.to === 'src/dead.ts#unreachableHelper').length,
  0,
);

// ---- Phase 2: composable controls present in the dashboard ----
// The orthogonal axes are wired in the inlined renderer (attributes are set
// at runtime; the browser test asserts they actually drive the view).
for (const ctl of ["control('structure'", "control('layout'", "control('size'",
  "control('color'", "control('link'", "'data-control'"]) {
  assert.ok(html.includes(ctl), `missing control wiring ${ctl}`);
}

// ---- Phase 3: filesystem + symbol structures, tree layout ----
assert.ok(html.includes('filesystem'));
assert.ok(html.includes('symbols'));
assert.ok(html.includes('tree'));

/* ASPIRATIONAL — uncomment each section as its phase lands.

// ---- Phase 4: treemap representation ----
assert.ok(html.includes('treemap'));

// ---- Phase 5: usage exploration ----
assert.ok(html.includes('references'));

*/

console.log('viz acceptance: all active sections passed');
