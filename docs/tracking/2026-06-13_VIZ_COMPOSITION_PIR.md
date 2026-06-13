# Visualization Composition & Exploration — Post-Implementation Review

**Date:** 2026-06-13 · **Duration:** single session (follows the dashboard
track + @endo/chat hardening)
**Commits:** 21925ef → a8066c8 (8 commits: design + 6 phases + this close-out)
**Test delta:** 35 → 43 tests; viz acceptance spec added (5 sections, all active)
**Suite health:** green (43/43)
**Design doc:** `2026-06-13_VIZ_COMPOSITION_DESIGN.md`

## 1. What Was Built

The dashboard's four hardcoded views were replaced by **composable,
orthogonal controls**: Structure × Layout × Node-encoding × Link-encoding.
Concretely:

- **Structures** (7): modules, file system, symbols (AST), types, calls,
  apis, references.
- **Layouts** (3): force-directed, tree (tidy hierarchy), treemap (squarified
  nested squares).
- **Node encoding**: size-by (7 metrics) and color-by (7 metrics), each a
  registry entry operating on a uniform node `meta` bag.
- **Link encoding**: label (none/target/relation/weight) and width
  (uniform/by-weight); module edges gained an import-multiplicity weight.
- **Usage exploration**: a reference index in the analyzer
  (`model.references`) plus a panel "used at" list and a focus mode that
  fades everything except a symbol and its use sites.

## 2. Timeline and Phases

| Phase | Commit | Delivered |
|---|---|---|
| design | 21925ef | track design doc + tracker |
| 0+1 | 74e6f74 | acceptance spec + reference index (analyzer) |
| 2 | 4c2c565 | orthogonal control rearchitecture; module-edge weight |
| 3 | f18aa7d | filesystem + symbols structures; tree layout; mountGraph refactor |
| 4 | 3b1c72d | squarified treemap |
| 5 | a8066c8 | references structure + usage focus |
| 6 | (this) | capstone verify, README, PIR |

## 3. Test Coverage

Analyzer: reference-index unit tests (type used across files incl.
type-annotation sites, declaration-name exclusion, dead code = 0 refs,
enclosing-symbol attribution). Renderer: the headless-Chromium test now
drives the `data-control` selectors across every structure, exercises the
node/link encoding axes, switches to tree and treemap layouts (asserting
synthesized directory groups and leaf-tile counts), and runs the full
focus→clear usage flow. The viz acceptance spec checks the reference index
and the presence of each control/structure/layout in the emitted HTML.
Accepted gap: the squarify geometry and force/tree math are exercised by the
browser smoke test, not unit-tested in isolation.

## 4. Bugs Found and Fixed

1. **Acceptance checked runtime DOM, not source** (Phase 2) — the spec
   looked for `data-control="structure"` in the static HTML, but those
   attributes are set at runtime via `setAttribute`. Fixed to assert the
   source wiring tokens (`control('structure'`, `'data-control'`); the
   browser test verifies the attributes actually drive the view. Lesson: a
   non-browser spec can only see inlined source, not the rendered DOM.
2. **Force-graph click flakiness in tests** (Phase 5) — clicking a node
   while the force sim was still moving timed out. Not a product bug; the
   focus test uses the static tree layout for stable hit targets.

## 5. Design Decisions and Rationale

- **Orthogonal axes over named views** — the user's explicit ask. Encoders
  operate on a uniform node `meta` bag so a new metric is a one-line registry
  entry; this directly retired the original per-view color duplication.
- **Hierarchy derived, not required** — flat structures get a synthesized
  directory hierarchy on demand, so tree and treemap work on *any* structure.
  Kept the axes genuinely independent (modules-as-treemap is meaningful).
- **References via identifier resolution** — reused the call graph's
  `resolveNodeToSymbolId` (one O(n) pass) rather than `ts.findReferences`;
  consistent with the existing accepted dynamic-dispatch limitation. Captured
  type-annotation usage neither the type nor call graph sees.
- **`mountGraph(animate)`** — one renderer for both force (animated) and tree
  (static positions); avoided a second pan/zoom/drag/search implementation.
- **Squarified treemap** — chosen over slice-and-dice for aspect ratios near
  1; the directory-group containers make it read as the requested "nested
  square breakdown".

## 6. Lessons Learned

- **A uniform node `meta` is the keystone.** Once every structure emitted the
  same metadata shape, size/color/legend/tooltip/treemap-value all became
  generic. The friction in the old code was exactly the absence of this.
- **Registry-driven UI compounds.** Adding the `references` structure in
  Phase 5 was ~20 lines because the control, encoders, legend, and panel all
  consumed registries — no plumbing.
- **Validate big features on the real target, not just the fixture.** The
  treemap and reference graph only proved their worth on @endo/chat (107
  files, 2384 refs); the 8-file fixture can't show a hairball or a dense
  treemap.

## 7. Metrics

@endo/chat: references 2384 (+1.2s analysis, ~4.9s total); model.json 693KB,
inlined HTML 539KB. Render node counts: modules 107, references 423,
filesystem-tree 113, filesystem-treemap 107 tiles — all error-free in
headless Chromium.

## 8. What's Next

Deferred (DEFERRED.md): JSDoc `@typedef`/`@implements` type extraction (would
populate the Types structure for plain-JS packages); re-export barrels and
`export default` as symbols; radial/clustered layouts; link labels capped at
≤90 edges (a per-edge label LOD would lift that). Usage focus could grow a
"callers vs. callees vs. references" toggle.

## 9. Key Files

`src/analyzer/references.ts` (new layer), `src/dashboard/assets/app.js`
(registries: STRUCTURES / LAYOUTS / SIZE_METRICS / COLOR_METRICS; mountGraph;
layoutTree; squarify/layoutTreemap; focus), `src/analyzer/modules.ts`
(edge weight), `examples/2026-06-13-viz-acceptance.mjs`.

## 10. Lessons Distilled

| Lesson | Distilled To | Status |
|---|---|---|
| A uniform node metadata shape makes encoders/legend/treemap generic | this PIR §6; dailies Phase 2 | recorded |
| Registry-driven UI makes new options ~free | this PIR §6 | recorded |
| Non-browser specs see inlined source, not runtime DOM | this PIR §4.1 | recorded |
| Big visualization features must be proven on a real target | this PIR §6; carries the @endo/chat hardening lesson forward | recorded |

(No principles directory yet — second track in this repo. If a third track
lands, create `docs/tracking/principles/` and migrate these distilled
lessons plus the prior track's.)
