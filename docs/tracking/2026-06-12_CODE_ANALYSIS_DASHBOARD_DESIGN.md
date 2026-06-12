# Code Analysis Dashboard — Track Design

**Date:** 2026-06-12
**Track:** Code Analysis Dashboard (single Track, no Series)
**Status:** In progress
**Acceptance spec:** `examples/2026-06-12-dashboard-acceptance.mjs`

## Progress Tracker

| Phase | Description | Status | Notes |
|---|---|---|---|
| 0 | Scaffold, fixture project, acceptance spec | ✅ done | commit 4cc77d6 — 8-file fixture; CLI emits meta-only model |
| 1 | Project loader + module dependency graph (+ cycles, file metrics) | ✅ done | commit 88407ed — tsconfig or scan loading; Tarjan SCC finds util/a↔b cycle |
| 2 | Symbol map + documentation coverage | ✅ done | commit 7a67d48 — 7 kinds incl. methods; JSDoc doc coverage per file |
| 3 | Type relationship graph | ✅ done | commit 01c7b72 — extends/implements/alias via checker |
| 4 | Static call graph | ✅ done | callee resolution incl. super/new/callbacks; `<module>` pseudo-callers; uncalled list; 20 tests green |
| 5 | Complexity metrics + git churn overlays | ⬜ | |
| 6 | Global/API usage map | ⬜ | |
| 7 | Dashboard generator + interactive UI | ⬜ | |
| 8 | Capstone demo (self-analysis) + PIR + README | ⬜ | |

Statuses: ⬜ not started / 🔄 in progress / ✅ done / ⏸️ blocked

## Problem

Understanding a large TypeScript/JavaScript codebase quickly requires
answers to several distinct questions (what is it made of, what depends on
what, what calls what, what is risky/complex/privileged). No single graph
answers them all. We want a layered inspection system: one CLI that
statically analyzes a TS/JS project and emits a self-contained interactive
HTML dashboard with multiple linked visualization layers.

## Architecture

```
src/
  cli.ts                  CLI entry: cad <projectDir> [-o out]
  model.ts                Shared output-model types (the JSON contract)
  analyzer/
    project.ts            Load ts.Program from tsconfig or file scan
    modules.ts            Layer 1: module dependency graph + cycle detection
    symbols.ts            Layer 2: AST/symbol map (+ Layer 10 doc coverage)
    types.ts              Layer 3: type relationship graph
    callgraph.ts          Layer 4: static call graph
    metrics.ts            Layer 8: cyclomatic complexity, sizes
    churn.ts              Layer 8: git change frequency
    apis.ts               Layer 7: global/platform API usage
  dashboard/
    generate.ts           Emit standalone index.html (data + app inlined)
    assets/app.js         Vanilla-JS force layout + UI (no runtime deps)
    assets/style.css
```

Single runtime dependency: `typescript` (compiler API). The dashboard is a
single generated HTML file with the analysis JSON and the renderer inlined —
no CDN, no server, opens from disk.

### Output model (the JSON contract)

One `AnalysisModel` object with sections per layer: `meta`, `files[]`
(path, loc, bytes, churn, docCoverage), `moduleGraph` (nodes/edges/cycles),
`symbols[]` (kind, name, file, span, exported, documented, complexity),
`typeGraph` (edges: extends/implements/alias), `callGraph`
(edges: caller→callee symbol ids), `apiUsage[]` (category, file, symbol,
callsite). Symbol ids are `file#qualifiedName` strings, stable across layers
so every view can cross-link.

### Phase dependencies

Phase 1 (program loading, file table) is the foundation for 2–6. Phase 2
(symbol table/ids) is the foundation for 3, 4, 5 (complexity attaches to
symbols) and 6 (API hits attach to symbols). Phase 7 consumes the full
model. Ordering encodes these dependencies.

### UX (Phase 7)

Progressive zoom, "city map" mental model:
1. Module dependency graph (force-directed) is the landing view.
2. Click a module → file/symbol listing with per-symbol metrics.
3. Tabs switch layers: Modules / Types / Calls / APIs.
4. Overlay toggles recolor nodes: complexity, churn, size, doc coverage,
   API sensitivity.

## Design decisions

- **Vanilla-JS renderer, not D3** — the dashboard must open from disk with
  no network. A minimal force simulation (~120 lines) avoids a CDN
  dependency and a bundler. Rejected: D3 via CDN (offline failure), npm
  bundling (build complexity disproportionate to need).
- **Static analysis only in v1** — runtime profiling, coverage ingestion,
  control-flow and data-flow graphs are deferred (see DEFERRED.md): they
  require either executing the target project (not possible generically) or
  per-function IR construction that does not fit this track. Module, symbol,
  type, call, API, complexity, churn, and doc layers are all derivable from
  the compiler API + git log and cover 8 of the 10 designed layers.
- **Call graph via AST callee resolution, not ts `findReferences`** —
  resolving each call expression's symbol to a known declaration is one pass
  and O(calls); reference-search per symbol is O(symbols × project).
  Accepted limitation: dynamic dispatch through interfaces is resolved to
  the declaration site, not all implementations.
- **Symbol id = `relativePath#qualifiedName`** — human-readable, stable,
  and unifies cross-layer linking in the UI.

## Test strategy

`node:test` suites under `test/`, run against the compiled `dist/` output
on a checked-in fixture project (`test/fixture/`) that deliberately contains:
an import cycle, a class hierarchy with an interface implementation, a type
alias, deep/branchy functions (complexity), fs/network/child_process usage,
documented and undocumented exports, and an unreachable function. Each phase
lands with tests asserting its layer's output on the fixture. The acceptance
spec runs the real CLI end-to-end on the fixture and checks the emitted
dashboard HTML.
