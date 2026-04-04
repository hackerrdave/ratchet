# Tactical Learnings: Silent Failure Detection Prompt Optimization

## What Works

- **Structured anti-pattern checklists with concrete examples** — Iterations 2, 4, 9–10 all improved scores by adding explicit pattern lists (empty catch blocks, `.catch(() => {})`, count-only logging). Specificity matters more than verbosity.
- **False Positive Prevention as a dedicated section** — Iteration 4 jumped +0.066 points by explicitly teaching the agent when NOT to flag errors (proper fallbacks, optional chaining for display ops, error counting in appropriate contexts). This prevented the 15% false positive penalty from dragging down scores.
- **Pre-scanning workflow that separates pattern detection from severity assessment** — Iteration 10 peaked at 0.924 by forcing exhaustive enumeration of ALL silent failures before contextual judgment, preventing missed detections.
- **Structured output format with location-to-pattern mapping** — Iterations 9–10 succeeded by requiring the agent to explicitly list code locations paired with specific anti-patterns in a single pass, rather than synthesizing findings after analysis.

## What Doesn't

- **Multi-pass line-by-line scanning with explicit "found/not found" markers** — Iterations 11–15 all regressed (scores 0.736–0.863) when we forced exhaustive checkpoint documentation for every pattern check. The overhead confused the model and degraded performance.
- **Premature complexity in phase structure** — Iteration 11 dropped 0.14 points by adding a "three-pass scanning workflow (Pattern Markers → Error Analysis → Severity-Independent Consolidation)." Simpler is better.
- **Mandatory evidence documentation for near-misses** — Iterations 12–13 fell to 0.80–0.823 by requiring the agent to justify both matches AND non-matches with line numbers and snippets. This over-constrained the output without improving accuracy.
- **Eliminating the anti-pattern checklist for a "scan then classify" approach** — Iteration 14 hit 0.736 by removing concrete pattern examples in favor of mechanical line-by-line scanning. The checklist examples are what made the agent effective.

## Tactics

- **Keep anti-pattern checklists concrete and exhaustive** — List specific patterns the test cases contain (empty catch, `.catch(() => {})`, silent returns, unhandled operations in catch, count-only logging) rather than abstract descriptions. Mirror test case structure.
- **Dedicate a section to false positive prevention with examples** — Don't just flag "acceptable error handling;" explicitly teach which patterns are OK (proper fallbacks, optional chaining for display-only ops, error counting in appropriate contexts). This directly improves the 15% false positive metric.
- **Use single-pass structured enumeration, not multi-pass workflows** — Force the agent to find and document ALL issues in one pass using a checklist format, not sequential passes. Iteration 10 proved simpler is better than elaborate phase structures.
- **Pair code locations with specific anti-pattern names** — Require output like "Line 42: empty catch block (pattern: `catch() {}`)," not vague descriptions. Concrete pairing prevents missed detections.
- **Separate pattern detection from severity assessment in the prompt structure, but execute in one pass** — Structure the prompt to force detection before judgment, but don't require the agent to literally scan multiple times. One structured pass is enough.
- **Avoid over-constraining output with "must verify" checkpoints for both matches and non-matches** — This creates noise and confusion. Only require documentation of actual findings, not exhaustive justification of every non-finding.