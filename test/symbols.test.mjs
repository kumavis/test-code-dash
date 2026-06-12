import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { analyze } = await import(join(root, 'dist', 'analyzer', 'index.js'));

const model = analyze(join(root, 'test', 'fixture'));
const byId = new Map(model.symbols.map((s) => [s.id, s]));

test('symbol kinds are classified', () => {
  assert.equal(byId.get('src/models.ts#AnimalKind').kind, 'typeAlias');
  assert.equal(byId.get('src/models.ts#Animal').kind, 'interface');
  assert.equal(byId.get('src/models.ts#Dog').kind, 'class');
  assert.equal(byId.get('src/models.ts#Dog.speak').kind, 'method');
  assert.equal(byId.get('src/models.ts#Dog.constructor').kind, 'method');
  assert.equal(byId.get('src/app.ts#classify').kind, 'function');
  assert.equal(byId.get('src/util/a.ts#SEPARATOR').kind, 'variable');
});

test('export detection', () => {
  assert.equal(byId.get('src/app.ts#run').exported, true);
  assert.equal(byId.get('src/services/network.ts#canResolve').exported, false);
});

test('doc detection: JSDoc counts, line comments do not', () => {
  assert.equal(byId.get('src/models.ts#Dog').documented, true);
  assert.equal(byId.get('src/models.ts#Puppy').documented, false);
  assert.equal(byId.get('src/util/a.ts#normalize').documented, true);
  assert.equal(byId.get('src/services/network.ts#ping').documented, false);
});

test('symbol spans are 1-based line ranges', () => {
  const dog = byId.get('src/models.ts#Dog');
  assert.ok(dog.line > 1 && dog.endLine > dog.line);
});

test('doc coverage per file', () => {
  const cov = Object.fromEntries(model.files.map((f) => [f.path, f.docCoverage]));
  assert.equal(cov['src/services/storage.ts'], 1);
  assert.equal(cov['src/services/network.ts'], 0);
  assert.equal(cov['src/index.ts'], null); // nothing exported
  // models.ts: AnimalKind, Animal, Dog documented; Puppy not -> 3/4
  assert.equal(cov['src/models.ts'], 0.75);
});
