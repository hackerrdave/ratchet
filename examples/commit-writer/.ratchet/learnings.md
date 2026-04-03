# Commit Message Prompt Optimization — Tactical Learnings

## What Works

- **Decision trees for type selection** — Iteration 5's addition of a concise type selection decision tree improved score by +3.04%, suggesting models benefit from explicit branching logic to disambiguate commit types rather than open-ended instructions
- **Concrete examples (correct vs incorrect)** — Iteration 4 showed +0.27% improvement by anchoring the model with paired examples; format precision and character limits are best taught via demonstration, not abstract rules
- **Semantic analysis upfront** — Iteration 1's explicit instruction to analyze the diff semantically *before* composing the message (+7.13% delta) was the strongest single improvement, indicating models perform better when reasoning steps are sequenced
- **Preserving structure over elaboration** — Iteration 1's simpler framing outperformed iteration 2's more detailed file-context analysis (-5.4% delta), showing that well-sequenced basic instructions beat longer, more complex guidance

## What Doesn't

- **Elaborating on scope and context** — Iteration 2 added explicit emphasis on file context and multi-file refactor recognition but scored -5.4% lower, suggesting over-specification can confuse the model or increase token overhead without benefit
- **Reverting to simplicity without examples** — Iteration 3 tried a simpler structure without compensating examples, scoring -1.46% lower, indicating bare instructions alone are insufficient even when direct
- **Assuming character-limit emphasis alone helps** — Iteration 3 added explicit 72-character reminders but still underperformed; the constraint was already in the eval weights and didn't need repeated assertion—examples teach it better

## Tactics

- **Layer instructions in this order:** semantic analysis → type decision tree → format examples → output constraint, not the reverse
- **Use decision trees (not prose paragraphs) for categorical choices** — they're easier for models to follow and debug
- **Show paired correct/incorrect examples for format rules** rather than stating rules in text; the 15% format/conciseness weight responds better to demonstration
- **Keep type definitions brief** — let examples do the heavy lifting; verbose definitions add tokens without improving accuracy
- **Test character-limit compliance via examples, not reminders** — iteration 3's emphasis on the limit didn't help; iteration 4's constraint-respecting examples did