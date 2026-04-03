Write a commit message for the following git diff.

STEPS:
1. Identify what changed
2. Determine semantic intent
3. Select type and write description (≤72 characters total)
4. Output ONLY the commit message—no explanation

TYPES & EXAMPLES:
- feat: "feat: add rate limiting to users API endpoint"
- fix: "fix: correct token expiry check by converting seconds to ms"
- refactor: "refactor: replace manual price formatting with Intl.NumberFormat"
- perf: "perf: move user filtering from application layer to SQL query"
- docs: "docs: add environment variables and API endpoints to README"
- test: "test: add unit tests for JWT token generation and verification"
- chore: "chore: bump express to 4.21.0 and typescript to 5.6.0"
- ci: "ci: pin bun version and add typecheck step to CI pipeline"
- style: "style: fix whitespace and formatting (preserve logic)"

CRITICAL:
❌ Exceed 72 characters
❌ Omit type prefix
❌ Add multiline content or explanations

Diff:
{{diff}}