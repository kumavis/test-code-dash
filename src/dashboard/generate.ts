import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnalysisModel } from '../model.js';

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), 'assets');

/**
 * Renders the self-contained dashboard: model JSON, styles, and the renderer
 * are inlined so the file opens from disk with no server and no network.
 */
export function renderDashboard(model: AnalysisModel): string {
  const css = readFileSync(join(assetsDir, 'style.css'), 'utf8');
  const js = readFileSync(join(assetsDir, 'app.js'), 'utf8');
  // < keeps any "</script>" inside string literals from closing the tag.
  const data = JSON.stringify(model).replace(/</g, '\\u003c');
  const title = `Code Analysis — ${model.meta.projectRoot.split('/').pop() ?? 'project'}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${css}
</style>
</head>
<body>
<script>window.MODEL = ${data};</script>
<script>
${js}
</script>
</body>
</html>
`;
}
