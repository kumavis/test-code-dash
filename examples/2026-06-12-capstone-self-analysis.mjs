// Capstone demo: the dashboard analyzes its own codebase.
//
// Meant to be read and run: it exercises the user-facing CLI against this
// repository, prints the kind of findings the dashboard surfaces, and
// leaves an interactive dashboard in out/self/index.html.
//
// Run: npm run build && node examples/2026-06-12-capstone-self-analysis.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'out', 'self');

execFileSync('node', [join(root, 'dist', 'cli.js'), root, '-o', out], { stdio: 'inherit' });
const model = JSON.parse(readFileSync(join(out, 'model.json'), 'utf8'));

const heading = (text) => console.log(`\n— ${text} ${'—'.repeat(Math.max(1, 56 - text.length))}`);

heading('Project shape');
console.log(`${model.meta.fileCount} files, ${model.files.reduce((n, f) => n + f.loc, 0)} lines, ${model.symbols.length} symbols`);
console.log(`module edges: ${model.moduleGraph.edges.length}, call edges: ${model.callGraph.edges.length}`);

heading('Dependency cycles');
console.log(model.moduleGraph.cycles.length
  ? model.moduleGraph.cycles.map((c) => '  ' + c.join(' <-> ')).join('\n')
  : '  none — the analyzer pipeline is acyclic');

heading('Most complex functions');
for (const s of [...model.symbols].filter((s) => s.complexity != null)
  .sort((a, b) => b.complexity - a.complexity).slice(0, 5)) {
  console.log(`  ${String(s.complexity).padStart(3)}  ${s.id}`);
}

heading('Privileged API surface');
const byCategory = new Map();
for (const u of model.apiUsage) {
  byCategory.set(u.category, (byCategory.get(u.category) ?? 0) + 1);
}
for (const [category, count] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${category.padEnd(12)} ${count} call sites`);
}

heading('Documentation gaps (exported, undocumented)');
for (const s of model.symbols.filter((s) => s.exported && !s.documented && s.kind !== 'method').slice(0, 8)) {
  console.log(`  ${s.id}`);
}

heading('Uncalled functions (entry points or dead code)');
for (const id of model.callGraph.uncalled.slice(0, 8)) console.log(`  ${id}`);

console.log(`\nInteractive dashboard: ${join(out, 'index.html')}\n`);
