import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { analyze } = await import(join(root, 'dist', 'analyzer', 'index.js'));

const model = analyze(join(root, 'test', 'fixture'));
const byId = new Map(model.symbols.map((s) => [s.id, s]));
const sitesFor = (id) =>
  model.references.filter((r) => r.to === id).map((r) => `${r.file}:${r.line}`);

test('captures type usage beyond heritage and calls', () => {
  const animal = sitesFor('src/models.ts#Animal');
  // type-annotation uses inside app.ts (param type, array type) — these are
  // in neither the type graph nor the call graph.
  assert.ok(animal.some((s) => s.startsWith('src/app.ts:')), animal.join());
  assert.ok(animal.length >= 4);
});

test('excludes the declaration name itself', () => {
  const decl = byId.get('src/models.ts#Animal');
  const declSite = `src/models.ts:${decl.line}`;
  assert.ok(!sitesFor('src/models.ts#Animal').includes(declSite));
});

test('dead code has no references; live functions do', () => {
  assert.equal(sitesFor('src/dead.ts#unreachableHelper').length, 0);
  assert.ok(sitesFor('src/app.ts#classify').length >= 1);
});

test('references carry the enclosing symbol', () => {
  // classify is referenced inside run(); inSymbol should be run's id.
  const ref = model.references.find((r) => r.to === 'src/app.ts#classify');
  assert.equal(ref.inSymbol, 'src/app.ts#run');
});
