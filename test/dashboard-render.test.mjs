// Renders the generated dashboard in headless Chromium: catches renderer
// JS errors that string-level HTML assertions cannot. Skips (with a note)
// when the Playwright browser is not installed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

let chromium;
try {
  ({ chromium } = await import('playwright'));
  await (await chromium.launch()).close();
} catch {
  chromium = null;
}

test('dashboard renders and every structure switches without errors', { skip: !chromium }, async () => {
  const out = mkdtempSync(join(tmpdir(), 'cad-render-'));
  execFileSync('node', [join(root, 'dist', 'cli.js'), join(root, 'test', 'fixture'), '-o', out]);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('file://' + join(out, 'index.html'));
  await page.waitForTimeout(400);

  // Landing structure: one circle per fixture module.
  assert.equal(await page.locator('circle.node').count(), 8);
  assert.ok((await page.locator('header h1').textContent()).includes('fixture'));

  // Drill down: click a node, detail panel fills in.
  await page.locator('circle.node').first().click();
  assert.ok((await page.locator('aside h2').textContent()).includes('.ts'));

  // Each structure renders nodes and stays error-free.
  for (const structure of ['types', 'calls', 'apis', 'modules']) {
    await page.locator('select[data-control="structure"]').selectOption(structure);
    await page.waitForTimeout(150);
    assert.ok((await page.locator('circle.node').count()) > 0, `${structure} structure has nodes`);
  }

  // Node encoding axes recolor/resize without breaking node count.
  await page.locator('select[data-control="color"]').selectOption('complexity');
  await page.locator('select[data-control="size"]').selectOption('churn');
  await page.locator('select[data-control="link"]').selectOption('weight');
  await page.locator('select[data-control="linkwidth"]').selectOption('weight');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('circle.node').count(), 8);

  // Tree layout draws nodes including synthesized directory groups.
  await page.locator('select[data-control="layout"]').selectOption('tree');
  await page.waitForTimeout(200);
  assert.ok((await page.locator('circle.node').count()) > 8, 'tree adds directory group nodes');

  // Filesystem structure + treemap: every source file becomes a leaf tile.
  await page.locator('select[data-control="structure"]').selectOption('filesystem');
  await page.locator('select[data-control="layout"]').selectOption('treemap');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('rect.tm.leaf').count(), 8);
  await page.locator('rect.tm.leaf').first().click();
  assert.ok((await page.locator('aside h2').textContent()).length > 0);

  await browser.close();
  assert.deepEqual(errors, []);
});

test('usage focus highlights a symbol and its use sites', { skip: !chromium }, async () => {
  const out = mkdtempSync(join(tmpdir(), 'cad-focus-'));
  execFileSync('node', [join(root, 'dist', 'cli.js'), join(root, 'test', 'fixture'), '-o', out]);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('file://' + join(out, 'index.html'));
  // Symbols + tree gives stable (static) node positions to click.
  await page.locator('select[data-control="structure"]').selectOption('symbols');
  await page.locator('select[data-control="layout"]').selectOption('tree');
  await page.waitForTimeout(250);

  // Find a referenced symbol, open it, focus its usages.
  const count = await page.locator('circle.node').count();
  let focused = false;
  for (let i = 0; i < Math.min(count, 14) && !focused; i++) {
    await page.locator('circle.node').nth(i).click({ force: true });
    if (await page.locator('a.focus-link').count()) {
      await page.locator('a.focus-link').first().click();
      await page.waitForTimeout(200);
      focused = (await page.locator('select[data-control="structure"]').inputValue()) === 'references';
    }
  }
  assert.ok(focused, 'focusing a symbol switches to the references structure');
  assert.ok((await page.locator('circle.faded').count()) > 0, 'unrelated nodes are faded');
  assert.ok((await page.locator('.focuschip').textContent()).includes('focused'));

  // Clearing focus un-fades everything.
  await page.locator('.focuschip .clear').click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('circle.faded').count(), 0);

  await browser.close();
  assert.deepEqual(errors, []);
});

test('empty layers show an explanatory message, not a blank canvas', { skip: !chromium }, async () => {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  // A plain-JS project with no classes/type-aliases -> empty Types view.
  const proj = mkdtempSync(join(tmpdir(), 'cad-jsonly-'));
  mkdirSync(join(proj, 'src'), { recursive: true });
  writeFileSync(join(proj, 'src', 'index.js'), 'export const f = () => f();\n');
  const out = mkdtempSync(join(tmpdir(), 'cad-jsonly-out-'));
  execFileSync('node', [join(root, 'dist', 'cli.js'), proj, '-o', out]);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('file://' + join(out, 'index.html'));
  await page.locator('select[data-control="structure"]').selectOption('types');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('circle.node').count(), 0);
  assert.ok(await page.locator('.view-empty').isVisible(), 'empty-state message shown');
  assert.match(await page.locator('.view-empty').textContent(), /type relationship/i);
  await browser.close();
  assert.deepEqual(errors, []);
});
