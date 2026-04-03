Based on the following changes, write a commit message in conventional commit format.

Analyze the diff to understand:
1. What was removed and what was added
2. The intent behind the change (bug fix, new feature, code quality improvement, etc.)
3. Why this change matters

Write a single-line commit message with format: `type: description`

Rules:
- Use one of these types: feat, fix, refactor, chore, docs, test, perf, ci, style, build
- Keep under 72 characters total
- Include "why" context only if it clarifies the intent (e.g., "fix: correct token check by converting seconds to milliseconds")
- Output only the commit message, no explanation

{{diff}}