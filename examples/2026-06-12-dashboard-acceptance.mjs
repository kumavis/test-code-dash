// Acceptance spec for the Code Analysis Dashboard track (Phase 0 artifact).
//
// Exercises the REAL user-facing entry point: the `cad` CLI, run against
// test/fixture. Sections below are uncommented as their phase lands; the
// track is DONE when this file runs clean with every section active.
//
// Run: npm run acceptance

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = join(root, 'test', 'fixture');
const out = mkdtempSync(join(tmpdir(), 'cad-acceptance-'));

// ---- Baseline (Phase 0): the CLI runs end-to-end and emits the model ----
execFileSync('node', [join(root, 'dist', 'cli.js'), fixture, '-o', out], {
  stdio: 'inherit',
});
const model = JSON.parse(readFileSync(join(out, 'model.json'), 'utf8'));
assert.equal(model.meta.tool, 'code-analysis-dashboard');
assert.ok(model.meta.analyzedAt);

// ---- Phase 1: module dependency graph ----
assert.equal(model.meta.fileCount, 8);
assert.ok(model.moduleGraph.nodes.includes('src/app.ts'));
assert.ok(
  model.moduleGraph.edges.some(
    (e) => e.from === 'src/app.ts' && e.to === 'src/models.ts',
  ),
);
// util/a.ts <-> util/b.ts is a deliberate cycle.
assert.equal(model.moduleGraph.cycles.length, 1);
assert.deepEqual(
  [...model.moduleGraph.cycles[0]].sort(),
  ['src/util/a.ts', 'src/util/b.ts'],
);
const appFile = model.files.find((f) => f.path === 'src/app.ts');
assert.ok(appFile.loc > 10 && appFile.bytes > 100);

// ---- Phase 2: symbol map + doc coverage ----
const byId = new Map(model.symbols.map((s) => [s.id, s]));
assert.equal(byId.get('src/models.ts#Dog').kind, 'class');
assert.equal(byId.get('src/models.ts#Animal').kind, 'interface');
assert.equal(byId.get('src/models.ts#AnimalKind').kind, 'typeAlias');
assert.equal(byId.get('src/models.ts#Dog.speak').kind, 'method');
assert.equal(byId.get('src/app.ts#classify').exported, true);
assert.equal(byId.get('src/models.ts#Dog').documented, true);
assert.equal(byId.get('src/models.ts#Puppy').documented, false);
const networkFile = model.files.find((f) => f.path === 'src/services/network.ts');
assert.equal(networkFile.docCoverage, 0); // ping is exported and undocumented
const storageFile = model.files.find((f) => f.path === 'src/services/storage.ts');
assert.equal(storageFile.docCoverage, 1);

/* ASPIRATIONAL — uncomment each section as its phase lands.

// ---- Phase 3: type relationship graph ----
assert.ok(
  model.typeGraph.some(
    (e) =>
      e.from === 'src/models.ts#Dog' &&
      e.to === 'src/models.ts#Animal' &&
      e.relation === 'implements',
  ),
);
assert.ok(
  model.typeGraph.some(
    (e) =>
      e.from === 'src/models.ts#Puppy' &&
      e.to === 'src/models.ts#Dog' &&
      e.relation === 'extends',
  ),
);

// ---- Phase 4: static call graph ----
assert.ok(
  model.callGraph.edges.some(
    (e) => e.from === 'src/app.ts#run' && e.to === 'src/app.ts#classify',
  ),
);
assert.ok(
  model.callGraph.edges.some(
    (e) =>
      e.from === 'src/services/network.ts#ping' &&
      e.to === 'src/services/network.ts#canResolve',
  ),
);
assert.ok(model.callGraph.uncalled.includes('src/dead.ts#unreachableHelper'));

// ---- Phase 5: complexity + churn overlays ----
const classify = byId.get('src/app.ts#classify');
assert.ok(classify.complexity >= 8, `classify complexity ${classify.complexity}`);
assert.ok(byId.get('src/util/b.ts#stripPunctuation').complexity <= 2);
// Fixture lives inside this git repo, so churn is a number >= 1.
assert.ok(appFile.churn >= 1);

// ---- Phase 6: global/API usage map ----
const categories = new Set(model.apiUsage.map((u) => u.category));
assert.ok(categories.has('filesystem'));
assert.ok(categories.has('network'));
assert.ok(categories.has('shell'));
assert.ok(categories.has('process'));
assert.ok(
  model.apiUsage.some(
    (u) => u.api === 'fetch' && u.inSymbol === 'src/services/network.ts#ping',
  ),
);

// ---- Phase 7: dashboard HTML ----
const html = readFileSync(join(out, 'index.html'), 'utf8');
assert.ok(html.includes('<!doctype html') || html.includes('<!DOCTYPE html'));
assert.ok(html.includes('src/app.ts')); // data is inlined
assert.ok(!/src=["']https?:/.test(html), 'no external scripts');
assert.ok(existsSync(join(out, 'model.json')));

*/

console.log('acceptance: all active sections passed');
