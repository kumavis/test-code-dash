import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { analyze } = await import(join(root, 'dist', 'analyzer', 'index.js'));

const model = analyze(join(root, 'test', 'fixture'));
const hits = model.apiUsage;

test('named node:fs import call site is a filesystem hit', () => {
  const hit = hits.find((u) => u.api === 'fs.readFileSync');
  assert.equal(hit.category, 'filesystem');
  assert.equal(hit.file, 'src/services/storage.ts');
  assert.equal(hit.inSymbol, 'src/services/storage.ts#loadConfig');
});

test('child_process import is a shell hit', () => {
  const hit = hits.find((u) => u.api === 'child_process.execSync');
  assert.equal(hit.category, 'shell');
  assert.equal(hit.inSymbol, 'src/services/network.ts#canResolve');
});

test('global fetch is a network hit inside ping', () => {
  const hit = hits.find((u) => u.api === 'fetch');
  assert.equal(hit.category, 'network');
  assert.equal(hit.inSymbol, 'src/services/network.ts#ping');
});

test('process.env accesses are process hits, one per line', () => {
  const envHits = hits.filter((u) => u.api === 'process.env');
  assert.ok(envHits.length >= 2);
  assert.ok(envHits.every((u) => u.category === 'process'));
});

test('import binding sites themselves are not usages', () => {
  // storage.ts line 1 is the import; first fs hit must be the call inside loadConfig.
  const fsHits = hits.filter((u) => u.file === 'src/services/storage.ts' && u.category === 'filesystem');
  assert.ok(fsHits.every((u) => u.line > 1));
});

test('clean modules report nothing', () => {
  assert.ok(!hits.some((u) => u.file === 'src/models.ts' || u.file === 'src/util/a.ts'));
});
