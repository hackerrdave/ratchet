# Tactical Learnings: Commit Message Prompt Optimization

## What Works

- **Character counting as a validation step** (iteration 9: +0.032 → 0.918 score) — Explicit instruction to draft, count, and revise if over 72 characters addresses conciseness scoring directly. Works better than abstract "be concise" guidance.
- **Front-loading output format constraints** — Iterations 1, 2, 4, 5 kept/improved when format rules were clear early. Iteration 13's attempt to move output-only rule to top failed (0.859), suggesting the constraint needs to be part of the flow, not isolated.
- **Identifying primary intent in multi-part diffs** (iteration 5: +0.01 → 0.886) — Explicitly defining "primary intent" as "most impactful or most visible change" improved scores when paired with type-selection guidance, not as standalone edge-case handling.
- **Type-selection before message writing** (iteration 2: +0.002 kept) — Analyzing diff nature to pick type first, then writing message, prevents type-message misalignment. Works incrementally rather than dramatically.
- **Single coherent message strategy** (iteration 4: +0.008 → 0.876) — Guidance to merge multi-part changes into one message by highlighting primary intent outperformed attempts to handle them separately.

## What Doesn't

- **Lengthy edge-case instructions** (iteration 6: -0.049, iteration 10: -0.038) — Detailed guidance on multi-change scenarios caused regressions. Model overshoots on edge cases when told to analyze them explicitly.
- **Abstract multi-line vs single-line framing** (iteration 3: -0.005) — Telling the model when to use multi-line vs single-line doesn't work; constraint enforcement (always single-line) works better.
- **Concrete character-counting examples** (iteration 11: -0.072, iteration 12: -0.027) — Adding before/after revision examples or overly detailed counting steps reduced scores. Simple "count and revise" instruction (iteration 9) outperforms elaborated examples.
- **Restructuring with secondary analysis sections** (iterations 13, 14: both -0.048 to -0.067) — Moving analysis guidance into separate "Analysis approach" sections or lookup tables caused failures. Original prompt structure was closer to optimal.
- **Verbose edge-case prioritization** (iteration 6: -0.049) — Explaining how to identify "architecturally/logically primary" change caused the model to overthink rather than pattern-match.

## Tactics

- **Iteration 9's character-counting approach is reusable** — "Draft the message, count characters, revise if needed" is actionable and generalizes to any length-constrained task. Keep this pattern.
- **Keep prompt structure stable; add constraints inline** — Iterations 7, 13, 14 restructured and failed. Best gains (iter 1→9) came from adding clarity to existing sections, not reorganizing.
- **Define ambiguous terms operationally** — "Primary intent" worked when defined as "most impactful or most visible" (iteration 5), not when left abstract. Apply this to any multi-option scenarios.
- **Avoid teaching edge-case handling explicitly** — Model learns better through task structure (enforce single-line, require type-first) than through detailed edge-case instructions. Constraints beat elaboration.
- **72-character limit needs active validation, not passive mention** — Iteration 9's drafting+counting step beat passive reminders. For any hard constraint, build in an explicit check step.
- **Type selection as a mandatory first step** (iteration 2) works incrementally. Pair it with one sentence of "why" guidance tied to diff patterns, not abstract definitions.