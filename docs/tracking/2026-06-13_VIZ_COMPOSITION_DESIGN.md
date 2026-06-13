# Visualization Composition & Exploration — Track Design

**Date:** 2026-06-13
**Track:** Visualization Composition & Exploration (extends the Code Analysis
Dashboard track)
**Status:** Complete (all 6 phases; PIR filed)
**Acceptance spec:** `examples/2026-06-13-viz-acceptance.mjs`

## Progress Tracker

| Phase | Description | Status | Notes |
|---|---|---|---|
| 0 | Acceptance spec (aspirational sections) | ✅ done | `examples/2026-06-13-viz-acceptance.mjs`; Phase 1 section active |
| 1 | Analyzer: reference index (symbol → use sites) | ✅ done | 2384 refs on chat (+1.2s); Animal's 5 use sites incl. type annotations; 41 tests green |
| 2 | Renderer rearchitecture: orthogonal Structure × Layout × Node × Link controls | ✅ done | 6 controls; metric registries; module-edge weight added; 42 tests green |
| 3 | Filesystem + Symbol (AST) structures, Tree layout | ✅ done | filesystem (dirs+files), symbols (file→symbol→member), tree layout; flat structures get synthesized dir hierarchy; 42 tests green |
| 4 | Treemap representation (nested squares) | ✅ done | squarified; dir groups nested; sized/colored by any metric; 42 tests green |
| 5 | Type/symbol usage exploration (focus + references panel) | ✅ done | references structure; panel "used at" + focus-usages; fade highlight + clear; 43 tests green |
| 6 | Tests, capstone refresh, docs | ✅ done | capstone verified; README composable-controls rewrite; PIR filed. Track complete. |

Statuses: ⬜ not started / 🔄 in progress / ✅ done / ⏸️ blocked

## Problem

The dashboard shipped four hardcoded views (Modules/Types/Calls/APIs), each
baking in its own data source, layout, and node/link encoding. The user
wants visualization decomposed into **orthogonal, composable axes** so any
data source can be drawn with any layout and any encoding, plus a non-graph
treemap and the ability to explore where a given symbol/type is used.

## The orthogonal model

A visualization = **Structure** + **Layout** + **Node encoding** + **Link
encoding**. The toolbar exposes one control per axis.

- **Structure** (what the nodes/edges *are*) — produces a generic
  `{ nodes, edges, hierarchical }` dataset from the model:
  - `modules` — files, import edges (existing)
  - `filesystem` — directories + files, containment edges (NEW, hierarchical)
  - `symbols` — files → symbols → members, containment (NEW, hierarchical, the "AST graph")
  - `types` — type heritage/alias edges (existing)
  - `calls` — call edges (existing)
  - `apis` — category↔file bipartite (existing)
  - `references` — symbol → use-site edges (NEW, from Phase 1)
  Every node carries a uniform `meta` bag (path, loc, bytes, churn,
  complexity, docGap, apiCount, kind, depth) so encoders work on any
  structure.

- **Layout** (how nodes are *positioned*):
  - `force` — force-directed (existing)
  - `tree` — hierarchical tidy-tree (NEW; requires a hierarchy, derived by
    directory when the structure is flat)
  - `treemap` — nested rectangles sized by a metric (NEW, non-graph)

- **Node encoding** — two independent selectors:
  - *size by*: fixed, lines, bytes, complexity, churn, API count, degree
  - *color by*: directory, complexity, churn, doc gaps, kind, API sensitivity

- **Link encoding**:
  - *label*: none, by relation/import specifier, by weight
  - *width*: fixed, by weight (import/call multiplicity)

Not every combination is meaningful (treemap ignores links; tree needs a
hierarchy). The control logic disables/derives as needed rather than
erroring.

## Phase 1: reference index

A one-pass walk over every identifier, resolving it to a project-declared
symbol via the existing `resolveNodeToSymbolId` (alias-following). Each use
site that is **not** the declaration's own name becomes a reference:
`{ to: symbolId, file, line, inSymbol: enclosingSymbolId | null }`, deduped
by (to, file, line). This is the foundation for "identify a type and where
it is used" and for the `references` structure. Bounded O(identifiers);
measured on the @endo/chat target before committing.

Model change: `AnalysisModel.references: ReferenceSite[]`.

## Phase dependencies

Phase 1 (references) is independent analyzer work. Phase 2 (rearchitecture)
is the foundation for 3–5 and must preserve the existing four structures
under the new control model (regression-guarded by the browser test). Phases
3/4 add structures and layouts; Phase 5 consumes the Phase 1 references for
focus/exploration. Phase 6 closes out.

## Test strategy

Analyzer: unit tests for the reference index on the fixture (a type used in
multiple files, a function referenced without being called, declaration
sites excluded). Renderer: extend the headless-Chromium test to exercise
each structure × layout combination, the treemap, and symbol-focus
highlighting — asserting nodes/rects render and zero console errors. The
acceptance spec gains a `references` section and a dashboard-controls
presence check.

## Design decisions

- **References via identifier resolution, not `ts.findReferences`** —
  consistent with the call-graph decision (one O(n) pass reusing
  `resolveNodeToSymbolId` vs. per-symbol search). Same accepted limitation:
  dynamic/structural uses resolve to the declaration site.
- **Hierarchy derived, not required** — flat structures (modules, types)
  get a directory-based hierarchy on demand so Tree/Treemap always have
  something to draw. Keeps the axes truly orthogonal.
- **Encoders operate on a uniform node `meta`** — structures populate one
  metadata shape; adding a metric is a one-line registry entry, not a
  per-view change. This is the lesson from the original overlay code, where
  each view recomputed its own colors.
