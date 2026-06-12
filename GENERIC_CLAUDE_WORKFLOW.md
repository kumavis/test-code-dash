# Generic Claude Workflow & Document Management Instructions

A project-agnostic distillation of a development methodology for AI-assisted
software work. It covers workflow discipline, document management, and the
end-to-end process of developing features — from research through
post-implementation review. Domain-specific content has been removed;
placeholders like *"the project's principles"* or *"the user-facing entry
point"* should be bound to your project's specifics.

---

## 1. Core Workflow Rules

### Commit discipline

- **Commit after completing each phase or sub-phase** — do not wait to be
  asked. After finishing a unit of work, immediately stage the relevant files
  and commit before moving on. *Uncommitted work is invisible work.*
- **Print the commit hash after large changes** (new features, multi-file
  modifications, phase completions) so it is visible in the conversation for
  reference and traceability.
- **Link commits in documentation** — when updating tracking docs, dailies, or
  a deferred-work queue to mark work complete, include the commit hash (e.g.,
  `(commit abc1234)`). This provides docs-to-code traceability and acts as a
  reminder to commit before documenting.
- **Commits trigger documentation updates** — every commit is a signal to
  update the current session's daily log with: what was done, design choices
  made, lessons learned, surprises encountered, and any blockers. Capture
  learnings while context is fresh; do not batch updates to end of session.
- **All tests green before moving on** — never proceed to the next phase with
  failing tests. A failing test is a signal, not noise. If a failure is
  genuinely pre-existing and unrelated, document it explicitly with a tracking
  reference before proceeding.

### Work tracking

- **Feature tracking documents** — create a tracking document
  (`docs/tracking/YYYY-MM-DD_HHMM_TOPIC.md`) *before* implementation begins;
  update it after completion.
- **Phase subdivision** — break large phases into lettered sub-phases
  (a, b, c…); track done vs. remaining explicitly.
- **Unambiguous work references** — when citing a work unit in commit
  messages, logs, or cross-document references, use a fully qualified name
  (e.g., `<Series> <Track>, Phase <N>.<sub>`). Bare phase numbers are
  ambiguous across parallel efforts. When in doubt, qualify.
- **Progress tracker for phased designs** — before writing any code from a
  phased design document, add a Progress Tracker table **near the top** of the
  design doc (not the bottom — it answers "where are we?", the most common
  question). Columns: Phase, Description, Status (⬜ not started / 🔄 in
  progress / ✅ done / ⏸️ blocked), Notes (commit hashes, context). Update it
  as each phase completes, in the same commit as the code or a fast-follow.
  A phase without a tracker update is an invisible phase.
- **Deferred-work queue** — maintain a single `DEFERRED.md`. When something
  must be deferred, add it **in the same commit**. Deferred work not tracked
  is abandoned work. At the start of each new work track, triage the queue:
  remove stale items, promote newly unblocked ones into scope.
- **Master roadmap** — maintain a single source-of-truth roadmap document
  linking every series/track, its design doc, its review, and its status.
  Writing a design doc or a review is a signal to update the roadmap. If work
  isn't linked there, it's invisible.

### Daily logs and standups

- **Daily logs are living documents** — maintain a session log
  (`docs/tracking/standups/YYYY-MM-DD_dailies.md`) throughout the working
  session: completed items, in-progress work, considerations, blockers.
  Prior days' logs are read-only records.
- **A "day" is creation-to-creation, not a calendar date** — the interval runs
  from the creation of the last standup/dailies pair to the creation of the
  next. Working sessions extend past midnight; do not create new files just
  because the clock rolled over.
- **Opening a new working interval** creates both documents at once: the
  user's standup (`docs/standups/standup-YYYY-MM-DD.org`) and the assistant's
  dailies log. The "Yesterday" section covers everything since the previous
  pair was created. The new dailies starts with a **"Carried forward"**
  section listing in-progress work and pending items.
- **Lessons distillation check** — when opening new dailies, scan the most
  recent post-implementation review and the past several dailies for lessons
  or patterns that should be distilled into the principles documents. Keep a
  **"Watching"** subsection for medium-term patterns not yet confirmed enough
  to codify (intermittent observations needing 2–3 more data points). This
  maintains medium-term memory across sessions.

### Document management

- **Designate canonical sources** — when a document exists in two formats
  (e.g., a canonical `.org`/source file and a generated `.md`/export), ALL
  edits go to the canonical file. Content added only to the generated artifact
  WILL BE LOST on the next export. Check before editing.
- **Personal notes are read-only** — the user's personal working notes may be
  read for context but never modified.
- **Design documents are living** — update them as implementation reveals new
  information. Stale design documents are worse than no design documents.
- **Documents have distinct homes** — during implementation: the *design doc*
  holds the current design (decisions, audit findings persist there as new
  subsections); the *dailies* hold the story of getting there (commit-by-commit
  narrative, lessons, surprises); the *standup* holds the user's personal
  notes. Don't put design decisions in the dailies or narrative in the design
  doc.

---

## 2. Document Taxonomy & Naming Conventions

| Artifact type | Pattern | Role |
|---|---|---|
| Research | `docs/research/YYYY-MM-DD_TOPIC.{org,md}` | Stage 1 output: literature/system survey, vocabulary |
| Audit | `docs/tracking/YYYY-MM-DD_TOPIC_AUDIT.md` | Stage 2 output: findings, gaps, recommendations |
| Track design | `docs/tracking/YYYY-MM-DD_TOPIC_DESIGN.md` | Stage 3 output: problem, architecture, phased roadmap |
| Self-critique | `docs/tracking/YYYY-MM-DD_TOPIC_SELF_CRITIQUE.md` | Critique findings — separate file, linked from design doc |
| External critique | `docs/tracking/YYYY-MM-DD_TOPIC_EXTERNAL_CRITIQUE.md` | External findings + the responses to each |
| Series master roadmap | `docs/tracking/YYYY-MM-DD_SERIES_MASTER.md` | Living document: thesis, tracks, dependency graph |
| Post-implementation review (PIR) | `docs/tracking/YYYY-MM-DD_TOPIC_PIR.md` | Stage 5 output: what was built, what was learned |
| Acceptance spec | `examples/YYYY-MM-DD-feature.<ext>` | Executable specification, written as Phase 0 |
| Handoff | `docs/tracking/handoffs/YYYY-MM-DD_TOPIC_handoff.md` | Session-to-session transfer of understanding |
| Principles | `docs/tracking/principles/TOPIC.org` | Canonical methodology and accumulated wisdom |
| Standup | `docs/standups/standup-YYYY-MM-DD.org` | User's daily notes |
| Dailies | `docs/tracking/standups/YYYY-MM-DD_dailies.md` | Assistant's daily report-out (living document) |
| Deferred queue | `docs/tracking/DEFERRED.md` | Single queue of deferred work items |

The principles directory holds the *why* behind the terse machine-readable
rules (e.g., `CLAUDE.md` + `.claude/rules/*`). Typical principles documents:

- `DESIGN_METHODOLOGY` — how to research, design, iterate, implement
- `DESIGN_PRINCIPLES` — the project's load-bearing principles
- `CRITIQUE_METHODOLOGY` — critique lenses and response formats
- `POST_IMPLEMENTATION_REVIEW` — PIR questions, template, anti-patterns
- `WORK_STRUCTURE` — the work-unit hierarchy and filing conventions
- `HANDOFF_PROTOCOL` — session continuation procedure
- `DEVELOPMENT_LESSONS` — distilled cross-cutting lessons
- `PATTERNS_AND_CONVENTIONS` — naming, style, code patterns

Maintenance loop: significant decisions follow the methodology; new patterns
go to PATTERNS_AND_CONVENTIONS; lessons go to DEVELOPMENT_LESSONS; direction
changes update the vision doc; significant features get a PIR.

---

## 3. Work Unit Hierarchy

```
Series
  └── Track
        ├── Phase
        │     └── Sub-phase (a, b, c, ...)
        └── Part (overflow for large Tracks)
              └── Phase
                    └── Sub-phase
```

- **Series** — a thesis-driven collection of related Tracks realizing one
  architectural vision. Has: a one-sentence *thesis*, a *convergence
  criterion*, a living *Master Roadmap* (dependencies, not deadlines), and a
  shared vocabulary. Create one only when multiple independently-designable
  Tracks serve a shared thesis.
- **Track** — a Stage 3 design document suitable for implementation; the
  primary unit of planned work. Has: a design doc, a progress tracker, an
  acceptance spec (Phase 0), and a PIR on completion. Create one when the work
  has 3+ phases with genuine dependencies and warrants design. Do NOT create
  one for a bug fix (just fix and commit), a one-session cleanup, or research.
- **Phase** — a coherent chunk delivering a testable, committable result.
  Phase ordering encodes architectural dependencies — getting it right is an
  architectural act, not a scheduling act.
- **Sub-phase** — a smaller commit-sized unit within a Phase.
- **Part** — overflow when a Track exceeds ~15 phases or clearly decomposes
  into distinct architectural sub-problems. Each Part gets its own design doc;
  Parts share the Track's thesis and acceptance spec.

| Scenario | Structure |
|---|---|
| Bug fix | No structure (commit directly) |
| Single feature | Track only |
| Large feature | Track with Parts |
| Architectural vision | Series with multiple Tracks |

### Audits

An **Audit** is a systematic inventory of current state against principles or
requirements: a *scope*, a *lens*, numbered *findings*, and *recommendations*
(often "create a Track for X"). An Audit identifies problems; it does not
design solutions. The robust pattern: **audit first, then design, then
implement**. An audit-less Track risks solving the wrong problem.

| Aspect | Forward Audit | Retrospective Audit (PIR) |
|---|---|---|
| Timing | Before implementation | After implementation |
| Question | "What's wrong / missing?" | "What did we learn?" |
| Output | Findings → Track scope | Lessons → principles / deferred queue |

### Escalation

| Situation | Action |
|---|---|
| Track grows beyond ~15 phases | Split into Parts |
| Multiple Tracks needed for one vision | Create a Series |
| Implementation reveals a design flaw | Return to design iteration |
| A Phase uncovers a gap in another Track | Add a Cross-Track Requirement |
| A PIR surfaces real bugs | Fix immediately; queue structural issues |

### Cross-Track Requirements

When one Track depends on infrastructure another Track will build, declare it
in a **Cross-Track Requirements** section of the dependent design doc:

| Requirement | Provider component | Why this is needed |
|---|---|---|
| What's needed | Which phase/component provides it | What breaks without it |

This informs the provider's priorities, justifies the dependent Track's
deferrals, and keeps a Series' dependency graph grounded in concrete needs.

---

## 4. The Five-Stage Design Methodology

```
 Stage 1         Stage 2         Stage 3          Stage 4         Stage 5
┌─────────┐    ┌──────────┐    ┌───────────┐    ┌───────────┐    ┌──────┐
│ Research │───►│  Audit   │───►│  Track    │───►│  Phases   │───►│ PIR  │
└─────────┘    └──────────┘    │  design   │    │  a, b, c  │    └──────┘
                               └───────────┘    └───────────┘
```

The pipeline is iterative, not waterfall: Stage 4 discoveries may return work
to Stage 3; Stage 5 findings may trigger new Stage 2 audits.

### Stage 1: Deep Research

Ground the work in proven and cutting-edge techniques.

- **Cast a wide net**: survey at least 3–5 existing approaches to the problem.
- **Separate essential from accidental**: what's fundamental to the domain vs.
  incidental to a particular implementation.
- **Name the theories**: named foundations are citable, shareable, and
  critiquable; a design grounded in named theory beats intuition.
- **Document as you go**: research not written down evaporates when context
  resets. The research document is the institutional memory.

Artifacts: research document, bibliography, a shared vocabulary for later
stages.

### Stage 2: Refinement and Gap Analysis

Refine understanding against the existing codebase; make qualified
recommendations.

- **Infrastructure gap analysis**: what exists, what's missing; the gaps
  shape the roadmap.
- **Tradeoff matrices**: make alternatives and their tradeoffs explicit;
  choose with eyes open.
- **Principle alignment check**: every recommendation must pass "does this
  uphold the project's principles?"
- **Opportunities over features**: identify what your unique combination of
  capabilities enables that nothing else offers — don't just fill gaps.
- **Concrete code measurements, not estimates from vision** (critical): gap
  analyses MUST include real counts — grep-backed call-site counts, actual
  function signatures, file lists. "~225 call sites" guessed from
  architecture is systematically wrong; "31 call sites (5 in X, 8 in Y…)"
  measured from code is authoritative. A Stage 2 doc claiming "~N sites"
  without measurement evidence is incomplete.

### Stage 3: Design Iteration

Produce a concrete design with a phased roadmap, refined through critique
until there is full clarity.

The cycle:

1. **Draft (D.1)** — a *complete* first draft: data structures, signatures,
   phase dependencies, test strategies, concrete examples. An incomplete
   draft invites incomplete critique.
2. **Pre-implementation benchmarks/probes** — for infrastructure work, build
   and run micro-benchmarks and adversarial examples BEFORE implementation.
   This is *design input*, not validation: the data routinely reveals that
   phases are no-ops, estimates are wrong, or the bottleneck is elsewhere.
   Cover **semantic axes** (the behavioral compositions the work must handle
   correctly), not just performance axes.
3. **Revise (D.2)** — fold probe findings back into the design.
4. **Self-critique** — apply the critique lenses (§6) before any external
   review. Findings go to a SEPARATE critique file, linked from the design doc.
5. **External critique (D.3+)** — invite adversarial review with an
   orientation briefing; respond per the grounded-pushback format (§6).
6. **Repeat** until all parties have clarity and confidence.

Key practices:

- **Invite adversarial critique** — seek critique that probes weaknesses, not
  confirmation. Confidence is where blind spots hide.
- **Distinguish design issues from implementation issues** — design ambiguity
  must be resolved before implementation; implementation details can be
  optimized later.
- **Pushback with context** — not all critiques are valid. When a critique
  misunderstands the system, push back with the fuller picture; the pushback
  sharpens the articulation of the design.
- **Phase dependencies are architecture** — the roadmap is an architectural
  statement, not a schedule.
- **Concrete over abstract** — every level of abstraction needs at least one
  traceable, concrete example.
- **Express the design in the system's own formalism** — if the project has a
  target paradigm or notation, model every key construct of the design in it
  before implementing. If a component cannot be expressed in the paradigm, it
  is not in the paradigm — regardless of what the prose claims. End the model
  with an "Observations" section: what's outside the paradigm and why; what
  impurities or notation gaps the modeling revealed.
- **Parity test skeleton for multi-path designs** — when the design introduces
  multiple equivalent computation paths that must agree, write the parity test
  skeleton during Stage 3 (it will fail — that's fine). Its purpose is to
  surface divergence classes as *design questions* rather than later bugs.
- **Stage 0 design gate** — before implementation begins, audit the completed
  design against the project's core design mantra/principles, component by
  component. Any component that fails must be redesigned or explicitly labeled
  as **scaffolding with a retirement plan** (what retires it, what replaces
  it). Unlabeled failures are violations.
- Budget for **at least one full critique round** (D.1 → critique → D.2).
  Experience shows the post-critique design is materially different — not
  refined, restructured. Critique is the mechanism by which designs converge;
  it is not overhead.

### Stage 4: Implementation

Execute the phased roadmap, shipping complete and sound results at each phase.

- **Completeness over deferral** — when you have clarity, vision, and full
  context, finish the work now. Half-built pieces get forgotten; re-acquiring
  context later costs more than doing the work fresh. Defer *only* on genuine
  dependency or genuine design uncertainty. "We'll come back to it" is a red
  flag.
- **Design issues surfacing mid-implementation is expected and healthy** —
  stop and address them; update the design doc; don't paper over them with
  partial quick fixes.
- **If a gap requires deeper infrastructure, build the correct abstraction**
  rather than the minimal patch — the correct abstraction composes.
- **Conversational implementation cadence** — long autonomous stretches let
  the implementer's habitual defaults silently override the design's intent.
  Each phase ends with a dialogue checkpoint: what was built, what surprised,
  what's next. Maximum autonomous stretch: ~1 hour or one phase boundary,
  whichever comes first; break longer phases into sub-phases. Drift correlates
  with autonomy length.
- **Test at every boundary** — every sub-phase ends with passing tests. Tests
  are the proof that the implementation matches the design.
- **Validate at the real user-facing entry point** — unit-level validation is
  necessary but not sufficient. A feature that passes internal tests but fails
  through the actual end-to-end user path is *not done*; mark it honestly
  (e.g., "DONE (unit only)") and track the gap. This is the single most
  common process gap.
- **Measure before, during, and after** — pre-implementation baselines,
  per-phase measurements (wall-clock, memory/allocation, one domain-specific
  counter), and a final A/B comparison. Regressions caught at the phase that
  introduced them are cheap; regressions found at the end are expensive to
  attribute.

#### Per-Phase Protocol

For each implementation phase, in order:

1. **Mini-design** — re-internalize the design target for THIS phase through
   conversation: which design-doc sections govern it; which critique
   obligations it carries; which principles are most load-bearing; where the
   phase is most likely to drift (name the risks BEFORE coding — they become
   checkpoints). Co-dependent with step 2; cycle until the scope is clear.
   Outcomes persist into the *design doc* as new subsections; the dailies get
   only a brief bookmark.
2. **Mini-audit (codebase)** — audit the ACTUAL code the phase touches:
   which functions, files, call sites, line numbers. Read the code; do not
   work from memory. Findings persist into the design doc.
3. **Principles challenge mid-flight** — filter every in-flight decision
   ("add a field?", "keep the old path?") through the project principles,
   with special scrutiny on the drift risks named in step 1.
4. **Diagnostic protocol on snag** — if stuck after 2–3 attempts, STOP
   iterating (see §7).
5. **Vision Alignment Gate** before committing (see below).
6. **Quantitative claim verification** — if the phase's design leans on a
   measured finding ("approach X wins by Y"), re-measure at phase close to
   verify the benefit actually landed. Architectural shape ≠ delivered
   benefit.
7. **Phase completion — a BLOCKING 5-step checklist, in order**:
   a. *Test coverage*: behavior added ⇒ tests exist. If none are needed
      (pure refactor, design-only), state why in the commit message.
      "No tests: refactor with zero behavioral change" is valid;
      "will add tests later" is not.
   b. *Commit* with a descriptive message.
   c. *Tracker*: update the design doc progress tracker (status + commit
      hash + key result).
   d. *Dailies*: append what was done, why, design choices, lessons,
      surprises — immediately, while the reasoning is fresh.
   e. *Proceed*: start the next phase only after a–d are done.

#### Vision Alignment Gate (per phase, before commit)

Four questions — applied **adversarially, not as a checklist**:

a. **Paradigm-aligned?** Does the implementation genuinely follow the
   project's architectural paradigm, or does it merely use its vocabulary?
   Off-paradigm code must be labeled scaffolding with a retirement plan.
b. **Complete?** Does it match ALL deliverables the design specified — code,
   registrations, tests, AND quantitative claims? Designed-but-not-implemented
   is invisible deferral. *Shape without benefit is also incomplete.*
c. **Vision-advancing?** Would the design's author recognize this as
   advancing the stated vision? If you must explain why a shortcut doesn't
   violate the vision, it probably does — name it as scaffolding.
d. **Drift-risks cleared?** Re-check every risk named in the mini-design.
   Risks that materialized must be handled before commit.

**Cataloguing vs. challenging** (critical): "✓ check passes" is cataloguing
and catches nothing. The challenge is "could this be MORE aligned?". Write
gate answers in TWO COLUMNS — Column 1: passes/doesn't; Column 2: could it be
more aligned? Column 1 alone is rationalization; Column 2 is where drift
surfaces. If the gate passes without challenging at least one inherited
pattern, it likely catalogued — re-run it.

Red-flag phrases that demand scrutiny at any gate: "temporary bridge",
"belt-and-suspenders", "partial retirement", "keeping the old path as
fallback", "for symmetry / for safety / for testing", "preserved for
backward-compat", "defensive guard", "pragmatic approach", "opt-in for now",
"validated but not deployed", "defaults to off for safety".

#### Hard rules distilled from repeated failures

- **Validated ≠ Deployed** — if new infrastructure is validated behind a flag
  alongside the old path, the work is NOT complete until the new path is the
  production default and the flag is deleted. Mark it honestly ("validated,
  not deployed") and schedule deployment immediately.
- **Belt-and-suspenders is a blocking red flag** — keeping the old mechanism
  alongside the new "for safety" does not provide defense-in-depth; it masks
  bugs in the new one (the old still "works" for the test case, hiding the
  new path's defect until the old is removed). Either delete the old (trust
  the new) or revert the new. Do not ship both.
- **Ban "pragmatic" as justification for dual paths** — replace it with
  "incomplete (deferred to X because Y)". "Pragmatic" rationalizes;
  "incomplete because…" tracks.
- **A dedicated test phase is mandatory per track** — during implementation,
  not as a follow-up. Manually-run validation probes are not regression tests.

#### Post-Implementation Protocol (after all phases)

1. **A/B benchmark** against the pre-implementation baseline; any regression
   beyond the project threshold requires investigation before closing.
2. **Instrumentation cleanup** — grep for debug prints, counters, temporary
   flags left active in production; remove or guard them.
3. **PIR** — read the PIR methodology BEFORE writing (§8).

### Stage 5: Composition and Extension

- **Composition is the test** — a well-designed feature composes with features
  it wasn't designed for; failure to compose is a design smell.
- **Capstone demo (mandatory for significant features)** — after the last
  phase and before the PIR, write a demo in the *user-facing* form of the
  system: a feature showcase meant to be read and run, not a test file. It
  discovers interface gaps invisible to unit tests, validates integration,
  establishes ground truth for "what works", and doubles as documentation.
  Aspirational not-yet-working usage stays in, commented out with notes — it
  becomes the specification for future work.
- **Update the living documents**: deferred queue, project memory/status,
  relevant principles docs, the original tracking document.
- **Identify what the feature newly enables** — extension paths should be
  visible.

---

## 5. Acceptance Specs as Executable Specifications

For ANY implementation track (not just user-visible features), write an
executable acceptance spec as **Phase 0**, before implementation:

1. The file exercises target behavior through the real user-facing entry
   point, in ideal user-facing form.
2. Include both working expressions (baseline canary) and commented-out
   aspirational ones (target behavior).
3. **Run it after every phase**, not just at the end. The design doc's
   progress tracker should note which sections each phase is expected to
   unlock; a phase is not DONE until its sections pass end-to-end. Late
   validation causes cascading fixes; per-phase validation keeps fixes local.
4. The track is not DONE until the file runs clean with all aspirational
   sections uncommented.

The acceptance spec is simultaneously: executable specification, progress
instrument, regression canary, and living documentation. Additionally,
maintain a single **canary file** exercising every landed feature *in
composition* (the environment a real user works in), updated as features land.

---

## 6. Critique Methodology

### The Lenses

Apply every lens to every critique round; tag findings by lens + number
(P1, R3…) for traceability.

- **Lens P — Principles Challenged**: take each major decision and actively
  *challenge* it against the project's load-bearing principles. Cataloguing
  ("✓ we follow principle X") catches nothing. Challenging is: "could this be
  MORE aligned? Is a principle being violated that we're rationalizing?"
  Every red-flag phrase (see §4) gets full scrutiny.
- **Lens R — Reality-Check (Code Audit)**: ground the design in what EXISTS.
  How many files touched, which functions/structs, how many call sites, what
  signatures, what tests cover the path? Verify the design's claims against
  the actual code (the Stage 2 audit can be wrong too). If you can't point to
  the specific lines a phase changes, the scope is speculative. Look for:
  inaccurate scope, hidden consumers, unrealistic migration paths.
- **Lens M — Paradigm-Mindspace**: challenge each design point against the
  project's architectural paradigm. Is this genuinely the paradigm, or a
  conventional design described with the paradigm's vocabulary? The signature
  test: if a component can be re-described in the old/default paradigm without
  changing its semantics, it isn't in the new one. Sequencing, scanning, and
  imposed ordering words are smells to interrogate.
- **Lens S — Structural**: check that the design consumes the project's
  existing structural machinery rather than hand-rolling parallel versions of
  it, and that required formal properties are declared, not assumed. S is not
  redundant with M: M catches paradigm drift; S catches missing structural
  machinery.

### Self-critique placement

Write self-critique findings to a SEPARATE file
(`YYYY-MM-DD_TOPIC_SELF_CRITIQUE.md`), linked from the design doc — a
persistent paper trail that doesn't bloat the design document.

### Orientation for external critics

Hand external reviewers a briefing that orients them to the project's
paradigm and evaluation criteria — domain experts instinctively propose
solutions in their habitual paradigm; their *problem-finding* is invaluable
even when their *solutions* must be redirected.

### Receiving external critique: grounded pushback

Argue back — grounded in the codebase AND the principles. This is rigor, not
defensiveness. For each finding, evaluate: Is it grounded in our actual code?
Does it align with our principles? Is it paradigm-appropriate? Does it reveal
something we missed (the most valuable kind — adopt the *problem*, find our
own *solution*)? Then respond with exactly one of:

- **Accept** — finding correct, resolution aligned. Incorporate.
- **Accept problem, reject solution** — real gap, misaligned fix. Say why;
  propose our own resolution.
- **Reject with justification** — premise false in our codebase or in
  conflict with a load-bearing principle. Cite the specific code/principle.
- **Defer with tracking** — valid but out of scope. Queue it with a reference.

Never accept a finding without evaluation; never reject without citing the
justifying code or principle.

---

## 7. Diagnostic Protocol When Blocked

When stuck after 2–3 failed attempts, STOP iterating and follow this protocol
(it exists to break the whack-a-mole fix-and-retry cycle):

1. **Audit the domain** — gather comprehensive data about the FULL scope of
   the problem. Don't fix one instance; understand ALL instances ("how many
   X are there?", not "which X is this failure missing?").
2. **Hypothesize from data** — specific, falsifiable hypotheses grounded in
   the audit. "X because Y", not "something is wrong".
3. **Test narrowly** — the smallest test that validates/invalidates each
   hypothesis. One hypothesis, one test. Don't run the full suite to check a
   theory about one module.
4. **Challenge by principles** — "is my approach principled, or am I working
   around a deeper issue?" Every time you're stuck, a principle is being
   violated — find which one.
5. **Reframe if still stuck** — question the problem framing itself. If the
   fix works but the problem persists, the framing is wrong; return to step 1
   with a new lens.

---

## 8. Post-Implementation Review (PIR)

### When

After significant features: multi-phase work, multi-session work, work with
architectural decisions, or work that taught something. Skip for routine bug
fixes and pattern-following changes. Write it **in the same session** as the
final commits — memory fades; git preserves facts but not reasoning.

### The 16 questions — use as a LIVE CHECKLIST, not a reference

Create a skeleton from the questions FIRST, then fill each section. PIRs
written "from memory of what a PIR looks like" systematically omit the
evaluative and meta-learning sections that make them valuable.

**Factual**: (1) stated objectives; (2) what was actually delivered
(quantified scope adherence); (3) timeline with time breakdown;
(4) what was deferred and why (intentional vs. scope creep).

**Evaluative**: (5) what went well (specific, codification candidates);
(6) what went wrong (and why the wrong path seemed right at the time);
(7) where we got lucky (near-misses to harden — requires honesty);
(8) what surprised us (the richest learning source); (9) how the architecture
held up (clean integration validates it; friction maps improvements).

**Forward-looking**: (10) what this enables; (11) what technical debt was
accepted (each with rationale + queue entry); (12) what we'd do differently
starting over (if "nothing", the design process worked).

**Meta-learning**: (13) which assumptions were wrong (more dangerous than
bugs — invisible until they bite); (14) what we learned about the problem
itself; (15) are we solving the right problem (double-loop learning);
(16) isolated outcome or pattern? — survey the **10 most recent PIRs** with a
longitudinal table (duration, test delta, commits, wrong assumptions, bugs,
design iterations). Patterns spanning 3+ PIRs are codification-ready; 5+
demand an architectural, not documentary, response.

### Template skeleton

Header block (date, duration, commits, test delta, code delta, suite health,
design-doc links), then: 1. What Was Built · 2. Timeline and Phases ·
3. Test Coverage · 4. Bugs Found and Fixed (with root-cause analysis) ·
5. Design Decisions and Rationale · 6. Lessons Learned · 7. Metrics ·
8. What's Next · 9. Key Files · 10. **Lessons Distilled** (mandatory table:
Lesson → Distilled To → Status; an empty section means the PIR lifecycle is
incomplete).

### Format principles

- Timeline is data (tables, timestamps, hashes), not narrative.
- Lessons must be specific and actionable — cite the incident. "Test early"
  is not a lesson.
- Quantify everything possible — the baselines inform future estimation.
- PIRs are a *source* of lessons, not a destination. Route each lesson to
  where future work will encounter it: implementation wisdom → lessons doc;
  patterns → conventions doc; status → project memory; deferred items →
  queue; methodology improvements → methodology doc.

### Collect DURING implementation (PIR quality is bounded by this)

- **Decision log** (the dailies serve this): what was decided, alternatives
  considered, context, rationale — recorded as it happens.
- **Surprise journal**: wrong assumptions, unanticipated interactions,
  harder/easier-than-expected items, as they happen.
- **Quantitative data**: git history, test metrics, the progress tracker, the
  acceptance spec's section-by-section status.
- **Design-to-implementation correspondence**: at each phase close, note
  whether the implementation matched the design and where it diverged.

### Pre-implementation practices that improve PIRs

- **Premortem**: before implementing, assume the work has failed and generate
  plausible reasons; the predictions become PIR evaluation criteria.
- **Before-action review** per phase: what are we trying to accomplish, what
  challenges do we anticipate, what have we learned from similar situations?

### Are the PIRs working?

Lessons from PIR N should appear as avoided mistakes in PIR N+1. If the same
lesson appears in three consecutive PIRs, the response must become
architectural, not documentary. (Single-loop: fix the bug. Double-loop:
change the process that produced it. Produce both.)

---

## 9. Session Handoff Protocol

When a session ends and a new one begins, the compaction summary is thin — it
captures *what happened*, not *what was understood*. A handoff document is a
**transfer of understanding**, not a summary.

### When to create

(1) context-window pressure suggests a restart; (2) a natural checkpoint
(design complete, phase complete); (3) the user requests a transition.
Location: `docs/tracking/handoffs/YYYY-MM-DD_TOPIC_handoff.md`.

### Structure

- **§1 Current Work State (PRECISE)** — structured data, not prose: track and
  phase, design doc path + version, last commit hash + message, copied
  progress-tracker table, next immediate task.
- **§2 Documents to Hot-Load (ORDERED)** — what the new session MUST read
  before any work, in two categories:
  - *Always-load*: project instructions, memory index, the methodology and
    principles documents, the master roadmap, the handoff protocol itself,
    and the master doc of the currently active work series.
  - *Session-specific*: the current design doc (IN FULL — not 40 lines), the
    critique docs, the Stage 1/2 documents, the latest dailies, referenced
    research. Each entry: path, size, and WHY it matters now.
- **§3 Key Design Decisions (RATIONALE)** — every major decision: what, why
  (which principle/critique/data), what was rejected and why. These must NOT
  be revisited without good reason — revisiting wastes the work that settled
  them.
- **§4 Surprises and Non-Obvious Findings** — counterintuitive items; the
  highest-risk things for a new session to get wrong. Each: what, why
  surprising, resolution.
- **§5 Open Questions and Deferred Work** — what was explicitly NOT resolved
  and where it's tracked.
- **§6 Process Notes** — conventions established during the session that the
  next session must follow.

### Hot-load reading protocol (new session)

1. Read the handoff document first (§1–§6).
2. Read the always-load documents (skim if recently read, but DO read).
3. Read EVERY session-specific document IN FULL — not sampled.
4. Summarize understanding back to the user BEFORE starting work.
5. The user validates the understanding — only then proceed.

"I have full context" requires having read every listed document, being able
to articulate every §3 decision, and knowing every §4 surprise. If any is
unclear, ASK before proceeding. Reading 40 lines and claiming full context is
not acceptable.

---

## 10. Testing & Verification Discipline (generic rules)

- **The full suite is a regression gate, not a diagnostic tool.** The moment a
  run shows failures: STOP; do not re-run. Read the persisted failure logs;
  categorize (stale build artifact vs. real failure vs. stale log); fix and
  verify with INDIVIDUAL test runs; run the full suite once at the end as the
  gate. Re-running the suite "to see which tests fail" wastes minutes per
  cycle and violates output capture.
- **Output capture**: run once, capture sufficient output (pipe to a file or
  tail enough lines for failures + summary). Never re-run a long command just
  to see a different part of its output.
- **Targeted runs with fresh builds**: after editing production code, run the
  affected tests through a runner that rebuilds the relevant artifacts —
  stale compiled test artifacts silently produce wrong results or
  "passes individually, fails in batch" mysteries.
- **Run merged-PR test files against post-merge main**: a PR's CI runs against
  the contributor's base, which may differ from current main. After merging
  any PR that adds/modifies tests, run those files individually against main
  before moving on. Known failure modes: references to APIs retired between
  the PR's base and main; snapshot drift between simultaneously merging PRs;
  test-only files escaping rebuild triggers.
- **Performance regression detection**: alert on per-case time exceeding ~2×
  its rolling median (above a noise floor) and suite time exceeding ~1.2× the
  rolling median. Moderate regressions are silent without explicit comparison.
- **Cheap static checks as hooks**: run instant syntax/lint checks after every
  edit and as a pre-commit hook; gate pushes on a recorded passing suite for
  HEAD. Hooks are bypassable for genuine emergencies only.
- **Concurrency in measurement**: never run competing benchmark comparisons
  concurrently — CPU contention corrupts timing data.

---

## 11. Delegation vs. Co-Design (sub-agents / workflows)

The organizing principle:

> Delegate the *multiple independent minds* work; keep the *one shared
> evolving understanding* work conversational.

**Good fit for delegation** (parallel, independent, synthesizable):
research sweeps; codebase grounding audits / reality-checks; adversarial
critique rounds where lenses run blind to each other and are reconciled
afterwards (parallelism enforces the lens-independence that solo sequential
critique erodes); mechanical migrations (a discovered work-list transformed
by a known recipe, verified per item); completeness/coverage sweeps; parity
verification across equivalent paths.

**Keep conversational**: open architectural questions, novel-design
implementation, decision-locking (the user's deliberation is load-bearing).

Guardrails:

- **The decision boundary**: a delegated workflow produces *material for a
  decision*; the human + main session *makes and locks* the decision and
  lands the code. No workflow autonomously closes a phase or commits to main.
- **Diff-back, don't land-in-workflow**: agents producing code RETURN a
  diff; the main session applies it at known-good HEAD and runs the gate.
  The main session is the single source of code-state truth.
- **Pin and verify code state**: every agent reading code must verify the
  intended HEAD SHA before trusting line numbers, and cite the SHA it
  verified against, so the synthesis can detect silent divergence (stale
  worktrees are a real, observed hazard).
- **Scale to stakes; start lean**: no agents for routine work; a few for
  grounding a moderate-stakes step; a full panel only for high-blast-radius
  architecture. Implementation is never a delegation tier (except
  verified-base mechanical migration).

---

## 12. Anti-Patterns (summary)

| Anti-pattern | Corrective |
|---|---|
| "We'll come back to it" | Defer only when genuinely blocked; track every deferral in the same commit |
| Quick fixes meeting criteria partially | Identify the design gap; ship the complete solution |
| Research without documentation | Write it down; rough notes beat nothing |
| Design without critique | At least one adversarial round; probe the confident parts |
| Implementation without tests | Tests are the proof the implementation matches the design |
| Unit-only validation | Validate through the real user-facing entry point before "DONE" |
| Cataloguing instead of challenging | Two-column gates; force "could this be MORE aligned?" |
| Floating above the codebase | Cite files, functions, line numbers, measured counts |
| Old paradigm disguised in new vocabulary | Apply the paradigm lens / reality check |
| Belt-and-suspenders dual paths | Delete the old or revert the new; never ship both |
| "Pragmatic" as justification | Rename to "incomplete (deferred to X because Y)" |
| Validated but not deployed | Flip the default, re-validate, delete the flag — then it's done |
| Whack-a-mole debugging | Stop after 2–3 attempts; run the diagnostic protocol |
| PIR filed and forgotten | Distill lessons into the living principles docs; verify uptake in the next PIR |
| Batched end-of-session doc updates | Update dailies/trackers alongside each commit |
