import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { analyze } = await import(join(root, 'dist', 'analyzer', 'index.js'));

const model = analyze(join(root, 'test', 'fixture'));
const byId = new Map(model.symbols.map((s) => [s.id, s]));

test('branchy function scores high, straight-line function scores 1', () => {
  // classify: 4 ifs + 1 ternary + 1 for + 1 nested if + 2 case clauses = 10
  assert.equal(byId.get('src/app.ts#classify').complexity, 10);
  assert.equal(byId.get('src/util/b.ts#stripPunctuation').complexity, 1);
});

test('try/catch and ?? count as decision points', () => {
  // loadConfig: try/catch (1) + two ?? (2) = 4
  assert.equal(byId.get('src/services/storage.ts#loadConfig').complexity, 4);
});

test('non-function symbols have null complexity', () => {
  assert.equal(byId.get('src/models.ts#Animal').complexity, null);
  assert.equal(byId.get('src/util/a.ts#SEPARATOR').complexity, null);
  assert.ok(byId.get('src/models.ts#Dog.speak').complexity >= 1);
});

test('churn is populated from git history', () => {
  for (const file of model.files) {
    assert.equal(typeof file.churn, 'number', `${file.path} churn`);
    assert.ok(file.churn >= 1, `${file.path} expected >=1 commit`);
  }
});

test('churn is null outside a git repository', async () => {
  const { mkdtempSync, cpSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'cad-nogit-'));
  cpSync(join(root, 'test', 'fixture'), dir, { recursive: true });
  const outside = analyze(dir);
  assert.ok(outside.files.length > 0);
  assert.ok(outside.files.every((f) => f.churn === null));
});
