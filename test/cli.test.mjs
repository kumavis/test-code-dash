import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = join(root, 'dist', 'cli.js');
const fixture = join(root, 'test', 'fixture');

test('CLI analyzes the fixture and writes model.json', () => {
  const out = mkdtempSync(join(tmpdir(), 'cad-cli-'));
  execFileSync('node', [cli, fixture, '-o', out]);
  const model = JSON.parse(readFileSync(join(out, 'model.json'), 'utf8'));
  assert.equal(model.meta.tool, 'code-analysis-dashboard');
  assert.equal(model.meta.projectRoot, fixture);
});

test('CLI exits non-zero without a project dir', () => {
  assert.throws(() => execFileSync('node', [cli], { stdio: 'pipe' }));
});
