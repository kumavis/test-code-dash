# Code Analysis Dashboard

A multi-layer static analysis dashboard for quickly understanding
TypeScript/JavaScript projects. One CLI run produces a **self-contained
interactive HTML dashboard** — no server, no CDN, opens straight from disk.

The dashboard is built from **composable, orthogonal controls** rather than
fixed views — pick what the graph *is*, how it is laid out, and how nodes and
links are encoded, independently:

| Axis | Options |
|---|---|
| **Structure** (what the graph is) | Module dependencies · File system · Symbols (AST) · Type relationships · Call graph · API usage · References (usage) |
| **Layout** (how it is positioned) | Force-directed · Tree (hierarchy) · Treemap (nested squares) |
| **Node size** | Uniform · lines · bytes · complexity · churn · API hits · connections |
| **Node color** | Directory · symbol kind · API sensitivity · complexity · churn · size · doc gaps |
| **Links** | label none/target/relation/weight · width uniform/by-weight |

Each axis answers a different question — *what depends on what*, *where are
the cycles*, *what is risky/hot/undocumented*, *which types define the
domain*, *what calls what*, *which code touches fs/network/shell/crypto*, and
**where is a given type or symbol used**.

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

- **Compose any view** — mix structure × layout × encoding freely, e.g. the
  file system as a treemap sized by lines and colored by complexity, or the
  call graph force-directed and sized by connections.
- **Treemap** — a nested-squares breakdown with directory groups, sized and
  colored by any metric; the fastest way to see where the bulk and the risk
  of a codebase sit.
- **Usage exploration** — click any symbol and "focus usages": the view
  switches to the reference graph and fades everything except that symbol
  and its use sites, answering "where is this type used?".
- **Drill-down panel** — inspect any node's files, symbols, metrics, calls,
  callers, type relationships, API hits, and use sites, all cross-linked.
- **Cycle highlighting** — import cycles are detected (Tarjan SCC) and drawn
  in red regardless of the active color encoding.
- **Search** — filter nodes in any structure by substring.

## Architecture

```
src/cli.ts                 CLI entry
src/model.ts               Output-model contract (the JSON schema, in types)
src/analyzer/
  project.ts               ts.Program loading (tsconfig or scan)
  modules.ts               module graph + cycles      symbols.ts    symbol map + docs
  types.ts                 type relationships         callgraph.ts  static call graph
  metrics.ts               cyclomatic complexity      churn.ts      git change frequency
  apis.ts                  privileged API usage       references.ts symbol use sites
src/dashboard/
  generate.ts              standalone HTML emitter
  assets/app.js,style.css  dependency-free renderer (structures, layouts,
                           encoders, treemap, focus, panel)
```

Single runtime dependency: `typescript`. Symbol ids (`path#qualifiedName`)
are stable across layers, which is what lets every structure cross-link and
what powers usage focus. The renderer is organized as registries —
structures, layouts, and node/link metrics — so a new option is a registry
entry, not a new view.

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
