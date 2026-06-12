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

test('dashboard renders and all views switch without errors', { skip: !chromium }, async () => {
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

  // Landing view: one circle per fixture module.
  assert.equal(await page.locator('circle.node').count(), 8);
  assert.ok((await page.locator('header h1').textContent()).includes('fixture'));

  // Drill down: click a node, detail panel fills in.
  await page.locator('circle.node').first().click();
  assert.ok((await page.locator('aside h2').textContent()).includes('.ts'));

  // Every tab renders nodes and stays error-free.
  for (const tab of ['Types', 'Calls', 'APIs', 'Modules']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.waitForTimeout(150);
    assert.ok((await page.locator('circle.node').count()) > 0, `${tab} view has nodes`);
  }

  // Overlay recolor on the Modules view.
  await page.locator('.toolbar select').selectOption('complexity');
  await page.waitForTimeout(150);
  assert.ok((await page.locator('circle.node').count()) === 8);

  await browser.close();
  assert.deepEqual(errors, []);
});
