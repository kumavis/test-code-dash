import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { analyze } = await import(join(root, 'dist', 'analyzer', 'index.js'));

const model = analyze(join(root, 'test', 'fixture'));
const edges = model.callGraph.edges.map((e) => `${e.from} -> ${e.to}`);

test('direct intra- and cross-module calls', () => {
  assert.ok(edges.includes('src/app.ts#run -> src/app.ts#classify'));
  assert.ok(edges.includes('src/app.ts#run -> src/services/storage.ts#loadConfig'));
  assert.ok(edges.includes('src/services/network.ts#ping -> src/services/network.ts#canResolve'));
  assert.ok(edges.includes('src/util/a.ts#normalize -> src/util/b.ts#stripPunctuation'));
});

test('calls inside arrow callbacks attribute to the enclosing function', () => {
  // run() calls normalize() inside lines.map((l) => ...)
  assert.ok(edges.includes('src/app.ts#run -> src/util/a.ts#normalize'));
});

test('top-level calls come from the module pseudo-node', () => {
  assert.ok(edges.includes('src/index.ts#<module> -> src/app.ts#run'));
});

test('new expressions resolve to constructors, super calls to base methods', () => {
  assert.ok(edges.includes('src/app.ts#run -> src/models.ts#Dog.constructor'));
  // Puppy declares no constructor; falls back to the class symbol.
  assert.ok(edges.includes('src/app.ts#run -> src/models.ts#Puppy'));
  assert.ok(edges.includes('src/models.ts#Puppy.speak -> src/models.ts#Dog.speak'));
});

test('uncalled set: dead helper plus the known dynamic-dispatch limitation', () => {
  assert.ok(model.callGraph.uncalled.includes('src/dead.ts#unreachableHelper'));
  // a.speak() through the Animal interface is not resolved to Puppy.speak —
  // accepted design limitation, asserted so a future fix shows up here.
  assert.ok(model.callGraph.uncalled.includes('src/models.ts#Puppy.speak'));
  assert.ok(!model.callGraph.uncalled.includes('src/app.ts#classify'));
  assert.ok(!model.callGraph.uncalled.includes('src/app.ts#run'));
});
