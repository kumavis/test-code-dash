import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { analyze } = await import(join(root, 'dist', 'analyzer', 'index.js'));

const model = analyze(join(root, 'test', 'fixture'));

test('module graph covers all 8 fixture files', () => {
  assert.equal(model.meta.fileCount, 8);
  assert.deepEqual(model.moduleGraph.nodes, [
    'src/app.ts',
    'src/dead.ts',
    'src/index.ts',
    'src/models.ts',
    'src/services/network.ts',
    'src/services/storage.ts',
    'src/util/a.ts',
    'src/util/b.ts',
  ]);
});

test('import edges resolve across directories', () => {
  const edges = model.moduleGraph.edges.map((e) => `${e.from} -> ${e.to}`);
  assert.ok(edges.includes('src/index.ts -> src/app.ts'));
  assert.ok(edges.includes('src/app.ts -> src/models.ts'));
  assert.ok(edges.includes('src/app.ts -> src/services/storage.ts'));
  assert.ok(edges.includes('src/util/a.ts -> src/util/b.ts'));
  // dead.ts has no edges in either direction
  assert.ok(!edges.some((e) => e.includes('src/dead.ts')));
});

test('every edge carries an import-multiplicity weight >= 1', () => {
  assert.ok(model.moduleGraph.edges.every((e) => Number.isInteger(e.weight) && e.weight >= 1));
});

test('the util/a <-> util/b cycle is detected, and only it', () => {
  assert.deepEqual(model.moduleGraph.cycles, [['src/util/a.ts', 'src/util/b.ts']]);
});

test('file metrics are populated', () => {
  const app = model.files.find((f) => f.path === 'src/app.ts');
  assert.ok(app.loc > 10);
  assert.ok(app.bytes > 100);
});
