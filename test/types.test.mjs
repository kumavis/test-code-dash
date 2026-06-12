import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { analyze } = await import(join(root, 'dist', 'analyzer', 'index.js'));

const model = analyze(join(root, 'test', 'fixture'));
const edges = model.typeGraph.map((e) => `${e.from} -${e.relation}-> ${e.to}`);

test('class implements interface', () => {
  assert.ok(
    edges.includes('src/models.ts#Dog -implements-> src/models.ts#Animal'),
    edges.join('\n'),
  );
});

test('class extends class', () => {
  assert.ok(edges.includes('src/models.ts#Puppy -extends-> src/models.ts#Dog'));
});

test('type alias references its target', () => {
  assert.ok(edges.includes('src/models.ts#Resident -alias-> src/models.ts#Animal'));
});

test('no self or duplicate edges', () => {
  assert.equal(new Set(edges).size, edges.length);
  assert.ok(model.typeGraph.every((e) => e.from !== e.to));
});
