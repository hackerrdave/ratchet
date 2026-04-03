Write a commit message for the following git diff.

ANALYSIS STEPS:
1. Identify what changed (added, removed, modified code)
2. Determine semantic intent (bug fix, feature, refactor, performance, docs, test, dependency, infrastructure, or style)
3. Select the appropriate type below
4. Write a concise, single-line description (≤72 characters total including "type: ")
5. Output ONLY the commit message—no explanation

TYPE SELECTION:
- feat: New functionality (not bug fixes)
- fix: Bug or security fix
- refactor: Code restructured without behavior change
- perf: Performance improvement
- docs: Documentation changes only
- test: New tests or test modifications
- chore: Dependencies, version bumps, tooling
- ci: CI/CD pipeline changes (.github, config)
- style: Formatting only (no logic change)

CRITICAL: Entire message ≤72 characters. No explanation, discussion, or line breaks.

CORRECT EXAMPLES:
✓ "fix: correct token expiry check by converting seconds to ms" (59 chars)
✓ "feat: add rate limiting to users API endpoint" (45 chars)
✓ "refactor: replace manual price formatting with Intl.NumberFormat" (64 chars)

DO NOT:
❌ Exceed 72 characters
❌ Omit type prefix
❌ Add multiline content or explanations

Diff:
{{diff}}