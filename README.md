# Code Analysis Dashboard

A multi-layer static analysis dashboard for quickly understanding
TypeScript/JavaScript projects. One CLI run produces a **self-contained
interactive HTML dashboard** — no server, no CDN, opens straight from disk —
that layers architecture, behavior, and risk views over one shared model:

| Layer | View | Answers |
|---|---|---|
| Module dependency graph | **Modules** tab | What depends on what? Where are the cycles? |
| AST / symbol map | drill-down panel | What is each file made of? |
| Type relationship graph | **Types** tab | Which types extend/implement/alias which? |
| Static call graph | **Calls** tab | What calls what? What is never called? |
| Global/API usage map | **APIs** tab | Which code touches fs, network, shell, crypto, DOM, DBs? |
| Complexity overlay | overlay selector | Where is the branchy, risky logic? |
| Churn overlay | overlay selector | What changes most often? |
| Doc coverage overlay | overlay selector | Which public surface is undocumented? |

## Usage

```sh
npm install
npm run build

node dist/cli.js <projectDir> -o <outDir>   # or: cad <projectDir> after npm link
open <outDir>/index.html
```

The analyzer loads the target's `tsconfig.json` when one exists inside the
project root, and falls back to scanning for source files (with `allowJs`)
otherwise. `<outDir>/model.json` holds the raw analysis for programmatic use.

Try it on itself:

```sh
node examples/2026-06-12-capstone-self-analysis.mjs
```

## The dashboard

- **Progressive zoom** — start at the module map ("city map" view), click any
  node to inspect its files, symbols, metrics, and API hits; follow
  cross-links between symbols, callers, and types in the detail panel.
- **Overlays** — recolor the module map by max complexity, git churn, file
  size, documentation gaps, or privileged-API sensitivity.
- **Cycle highlighting** — import cycles are detected (Tarjan SCC) and drawn
  in red.
- **Search** — filter nodes in any view by substring.

## Architecture

```
src/cli.ts                 CLI entry
src/model.ts               Output-model contract (the JSON schema, in types)
src/analyzer/
  project.ts               ts.Program loading (tsconfig or scan)
  modules.ts               module graph + cycles      symbols.ts   symbol map + docs
  types.ts                 type relationships         callgraph.ts static call graph
  metrics.ts               cyclomatic complexity      churn.ts     git change frequency
  apis.ts                  privileged API usage
src/dashboard/
  generate.ts              standalone HTML emitter
  assets/app.js,style.css  dependency-free renderer (force layout, views, panel)
```

Single runtime dependency: `typescript`. Symbol ids (`path#qualifiedName`)
are stable across layers, which is what lets every view cross-link.

Known limitations and deferred layers (control-flow graph, data-flow graph,
runtime profiling, coverage ingestion) are tracked in
`docs/tracking/DEFERRED.md`. Notably, dynamic dispatch through interfaces is
not resolved to implementations in the call graph — such targets can appear
as "uncalled".

## Development

```sh
npm test              # build + unit/integration suites (node:test)
npm run acceptance    # end-to-end acceptance spec against test/fixture
```

The browser render test uses Playwright's Chromium when installed
(`npx playwright install chromium`) and skips otherwise.

Project methodology documents live in `docs/tracking/` (design doc with
progress tracker, dailies, deferred queue, post-implementation review),
following `GENERIC_CLAUDE_WORKFLOW.md`.
