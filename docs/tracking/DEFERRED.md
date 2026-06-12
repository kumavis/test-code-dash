# Deferred Work Queue

| Item | Deferred from | Reason | Unblock condition |
|---|---|---|---|
| Control flow graph view (design layer 5) | Code Analysis Dashboard, Stage 3 | Requires per-function CFG construction (basic blocks, branch/loop/throw edges) — a distinct IR not provided by the compiler API; disproportionate to this track | Dedicated CFG track; symbol spans in the model give it an attachment point |
| Data flow graph view (design layer 6) | Code Analysis Dashboard, Stage 3 | Depends on CFG + def-use analysis | After CFG track |
| Runtime profiling layer (design layer 9) | Code Analysis Dashboard, Stage 3 | Requires executing the analyzed project; no generic safe harness for arbitrary targets | Add an opt-in `--profile <cmd>` mode ingesting V8 CPU profiles; model already separates static vs. dynamic fields |
| Test coverage overlay (design layer 8, coverage axis) | Code Analysis Dashboard, Stage 3 | Needs an Istanbul/nyc coverage file from the target project; format ingestion is straightforward but untestable without target-run coverage | Accept `--coverage <coverage-final.json>` and join on file paths |
| Hierarchical/clustered graph layout alternative | Code Analysis Dashboard, Phase 7 | Force-directed layout shipped first; clustered package map is a rendering alternative, not new analysis | UI iteration track |
