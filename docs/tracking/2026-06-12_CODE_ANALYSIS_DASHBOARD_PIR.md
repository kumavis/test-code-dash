# Code Analysis Dashboard — Post-Implementation Review

**Date:** 2026-06-12 · **Duration:** single session
**Commits:** daa5685 → 6154931 (9 commits, one per phase + track setup)
**Test delta:** 0 → 35 tests (+ 8-section acceptance spec, all active)
**Code delta:** ~2,400 lines (analyzer ~700, renderer ~700, tests ~600, fixture ~150)
**Suite health:** green (35/35; browser test runs in CI-less env via Playwright, skips when absent)
**Design doc:** `2026-06-12_CODE_ANALYSIS_DASHBOARD_DESIGN.md`

## 1. What Was Built

A CLI (`cad <projectDir> -o <outDir>`) that statically analyzes a TS/JS
project via the TypeScript compiler API and emits `model.json` plus a
self-contained interactive HTML dashboard: module dependency graph with
cycle detection, symbol map, type relationship graph, static call graph,
privileged-API usage map, complexity/churn/size/doc-gap overlays, search,
and a cross-linked drill-down panel. 8 of the design's 10 layers shipped;
CFG, DFG, runtime profiling, and coverage ingestion deferred with unblock
conditions (`DEFERRED.md`).

## 2. Timeline and Phases

| Phase | Commit | Delivered |
|---|---|---|
| setup | daa5685 | design doc, tracker, deferred queue, dailies |
| 0 | 4cc77d6 | scaffold, 8-file fixture, acceptance spec (sections commented) |
| 1 | 88407ed | program loading, module graph, Tarjan cycles, file metrics |
| 2 | 7a67d48 | symbol map (7 kinds), doc coverage |
| 3 | 01c7b72 | type graph (extends/implements/alias) |
| 4 | 7ee43f2 | call graph, module pseudo-callers, uncalled set |
| 5 | 7ee6ae0 | cyclomatic complexity, git churn |
| 6 | b92c30f | API usage map (3 detection sources) |
| 7 | c8533a1 | dashboard generator + renderer, browser render test |
| 8 | 6154931 | capstone self-analysis, README |

## 3. Test Coverage

Per-layer unit/integration suites against a deliberately pathological
fixture; exact-value pins where drift matters (complexity counts, cycle
membership, doc-coverage fractions); negative cases (non-git churn, clean
modules, shadowed globals excluded by design); end-to-end acceptance via the
real CLI; headless-Chromium render test asserting all four views mount with
zero page errors. Gap, accepted: renderer internals (force math, pan/zoom)
are exercised only by the browser smoke test, not unit-tested.

## 4. Bugs Found and Fixed

1. **`node --test test/` failed on Node 22** (Phase 0) — directory arg
   resolved as a CJS module. Root cause: runner arg semantics, not code.
   Fix: explicit glob in the npm script.
2. **Dashboard payload test mis-extracted the JSON** (Phase 7) — split on
   `';\n'` but the script tag is single-line; the "payload" silently
   included the rest of the document and failed correctly-by-accident.
   Test bug; fixed to split on `';</script>'`. Lesson: a failing test must
   be read as carefully as failing code.
3. **Tracker pre-filled with invented commit hashes** (setup) — caught and
   reverted before commit. Root cause: writing the tracker "as it will
   look" instead of "as it is". The workflow's "a phase without a tracker
   update is invisible" cuts both ways: a tracker ahead of reality is
   worse than one behind it.

## 5. Design Decisions and Rationale

- **Vanilla-JS renderer over D3/CDN** — offline-first single artifact;
  ~700-line renderer was the right cost. Held up: zero runtime deps, file://
  works.
- **Symbol id = `path#qualifiedName`** — the load-bearing decision; every
  layer cross-links through it and the UI's drill-down fell out for free.
- **Callee resolution one-pass over `findReferences`** — O(calls), and the
  accepted dynamic-dispatch limitation is *pinned by a test* so improving it
  is a visible decision, not silent drift.
- **`<module>` pseudo-callers** — without them every entry point looks dead;
  with them "uncalled" is a meaningful dead-code/entry-point signal.
- **Playwright as dev-only, skip-if-absent** — real-entry-point validation
  without making the build depend on a 113 MB browser download.

## 6. Lessons Learned

- **The acceptance-spec-with-commented-sections mechanism worked** — each
  phase ended by uncommenting its section; the spec caught integration shape
  (e.g. `inSymbol` ids) that unit tests didn't force.
- **Fixture-first made every layer cheap to verify** — designing the fixture
  to contain each layer's target (cycle, dead code, branchy function,
  privileged APIs) meant assertions wrote themselves. Cost: fixture changes
  ripple (adding `Resident` moved a doc-coverage fraction; intended, but it
  shows fixture edits are API edits).
- **Checker-based resolution beats syntax matching** — alias-following
  (`getAliasedSymbol`) gave correct cross-module edges in types, calls, and
  global-shadowing checks from one shared helper (`resolve.ts`).

## 7. Metrics

Self-analysis (capstone): 13 files, 969 lines, 58 symbols, 30 module edges,
35 call edges, 0 cycles, 12 API hits. Own hotspots: `findApiUsage` cx 31,
`collectSymbols` cx 26 — honest candidates for decomposition. Analysis run
time on self: ~1.5 s (dominated by `ts.createProgram`).

## 8. What's Next

Deferred queue, in priority order: coverage ingestion (cheapest, format
join), runtime profiling via V8 CPU profiles (`--profile`), CFG track (gets
its attachment point from symbol spans), DFG (after CFG). UI iteration:
clustered/hierarchical layout for large projects (force layout will get
crowded beyond ~300 nodes); `findApiUsage` decomposition.

## 9. Key Files

`src/analyzer/*.ts` (one layer per file), `src/model.ts` (contract),
`src/dashboard/generate.ts` + `assets/app.js` (artifact),
`examples/2026-06-12-dashboard-acceptance.mjs` (spec),
`test/fixture/` (pathological target).

## 10. Lessons Distilled

| Lesson | Distilled To | Status |
|---|---|---|
| Pin accepted limitations with tests so fixes are visible decisions | dailies (Phase 4); candidate for a principles doc once one exists | recorded |
| Tracker must trail reality, never lead it | dailies (setup note) | recorded |
| Read failing tests as suspiciously as failing code | this PIR §4.2 | recorded |
| Fixture edits are API edits — expect assertion ripple | dailies (Phase 3) | recorded |

(First track in this repo: no principles directory exists yet; if a second
track lands, create `docs/tracking/principles/` and move these there.)
