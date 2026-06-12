import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { analyze } = await import(join(root, 'dist', 'analyzer', 'index.js'));
const { renderDashboard } = await import(join(root, 'dist', 'dashboard', 'generate.js'));

const model = analyze(join(root, 'test', 'fixture'));
const html = renderDashboard(model);

test('dashboard is a complete standalone document', () => {
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('window.MODEL ='));
  assert.ok(html.includes('Code Analysis Dashboard renderer'));
  assert.ok(html.includes('--bg: #0f1419')); // styles inlined
  assert.ok(!/\bsrc=["']https?:/.test(html), 'no external scripts');
  assert.ok(!/\bhref=["']https?:/.test(html), 'no external styles');
});

test('model data is inlined and script-safe', () => {
  assert.ok(html.includes('src/app.ts'));
  // No raw "<" inside the JSON payload can terminate the script block.
  const payload = html.split('window.MODEL = ')[1].split(';</script>')[0];
  assert.ok(!payload.includes('</'), 'JSON payload must escape <');
});

test('CLI writes both model.json and index.html', () => {
  const out = mkdtempSync(join(tmpdir(), 'cad-dash-'));
  execFileSync('node', [join(root, 'dist', 'cli.js'), join(root, 'test', 'fixture'), '-o', out]);
  const written = readFileSync(join(out, 'index.html'), 'utf8');
  assert.ok(written.includes('window.MODEL ='));
  JSON.parse(readFileSync(join(out, 'model.json'), 'utf8'));
});
