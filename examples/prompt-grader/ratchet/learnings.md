# Tactical Learnings: Sentiment Classification Prompt Optimization

## What Works

- **Example-based guidance outperforms explicit rules** — Iterations 4, 6, and 10 added worked examples and achieved 0.9767–1.0 scores, while iterations 1–3 that added explicit classification criteria all scored ≤0.9067. The model reasons better from concrete cases than abstract instructions.

- **Minimal, clear constraints maximize performance** — The baseline prompt (iteration 2, 0.9533) succeeded by explicitly requiring JSON-only output with no markdown/explanation. Additions that preserved this clarity (iteration 4+) maintained or improved scores; verbose additions degraded them.

- **Mixed-sentiment examples guide complex cases** — Iteration 6's addition of a neutral mixed-sentiment example (alongside a positive one) achieved a perfect 1.0 score, suggesting the model generalizes well from 2–3 diverse worked examples without needing exhaustive rule sets.

- **Worked examples are low-risk improvements** — All successful kept iterations (4, 6, 10) used examples as the only substantive change, avoiding the instruction creep that tanked earlier attempts.

## What Doesn't

- **Explicit classification criteria degrade accuracy** — Iterations 1 and 3 added rules like "dominant tone wins" or "major issues outweigh minor quibbles" and both scored 0.9067 (–4.66% from baseline). The model appears overconstrained by prescriptive rules.

- **Multiple examples without clear stopping point** — Iteration 5 attempted to extend iteration 4's success with a second neutral example but reverted to 0.9533 (–2.34%). Two well-chosen examples (iteration 6) outperformed three.

- **Instructions on confidence scoring alone don't improve the metric** — Iteration 4 (second run) added explicit guidance on confidence-to-clarity mapping and scored 0.93 (–2.33%), suggesting confidence handling is emergent from task clarity rather than explicit instruction.

- **Sarcasm/irony examples may not generalize** — Iteration 10 added a sarcastic-negative example and maintained 1.0, but this likely reflects overfitting to the test set rather than true robustness; no follow-up iteration tested generalization.

## Tactics

- **Use 2–3 worked examples covering diverse edge cases** — Iteration 6 achieved 1.0 with one positive mixed-sentiment example and one truly neutral example. Stick to this density; more examples risk dilution.

- **Preserve JSON-only output constraint in all changes** — Every successful iteration maintained "output only valid JSON" instruction. Make this non-negotiable in future edits.

- **Test single-example additions first, then pairs** — Iteration 4 (one example) scored 0.9767; iteration 6 (two examples) scored 1.0. This suggests a pattern: validate one example before adding a second.

- **Choose examples covering sentiment ambiguity, not explicit rules** — Iteration 6's neutral mixed-sentiment example taught the model better than iteration 3's "dominant tone wins" rule. Prioritize edge cases over instruction.

- **Stay under 500 tokens by using minimal preamble** — The baseline prompt's success relied on brevity. New examples should replace verbose explanation, not add to it.

- **Avoid iterating on the same example type** — Iterations 7–9 added negative/neutral examples to the iteration 6 winner (1.0) and all degraded to 0.9767 or 0.9533. Once 1.0 is achieved, treat it as a local optimum unless new test failures emerge.