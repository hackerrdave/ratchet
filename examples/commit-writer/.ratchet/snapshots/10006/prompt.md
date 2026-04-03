Write a commit message for the following git diff.

STEPS:
1. Identify what changed
2. Determine semantic intent
3. Select type and write description (≤72 characters total)
4. Output ONLY the commit message—no explanation

TYPES & EXAMPLES:
- feat: New functionality → "feat: add rate limiting to users API endpoint"
- fix: Bug/security fix → "fix: correct token expiry check by converting seconds to ms"
- refactor: Code restructured, same behavior → "refactor: replace manual price formatting with Intl.NumberFormat"
- perf: Performance improvement → "perf: move user filtering from application layer to SQL query"
- docs: Documentation only → "docs: add environment variables and API endpoints to README"
- test: New/modified tests → "test: add unit tests for JWT token generation and verification"
- chore: Dependencies/tooling → "chore: bump express to 4.21.0 and typescript to 5.6.0"
- ci: CI/CD changes → "ci: pin bun version and add typecheck step to CI pipeline"
- style: Formatting only → (preserve logic, fix whitespace/formatting)

CRITICAL:
❌ Exceed 72 characters
❌ Omit type prefix
❌ Add multiline content or explanations

Diff:
{{diff}}