# Goal
Improve the commit message prompt to generate accurate, well-formatted conventional commits from git diffs.

# Prompt
prompt.md

# Constraints
- Must keep the {{diff}} placeholder
- Must output only the commit message, no explanation or commentary
- Must use conventional commit format (type: description)
- Valid types: feat, fix, refactor, chore, docs, test, perf, ci, style

# Eval
- Test cases: test_cases.json
- Target: claude-haiku-4-5-20251001
- Correct commit type (30%)
- Accurately describes the change (40%)
- Conventional commit format with no extra text (15%)
- Concise — single line, under 72 characters (15%)

# Context
- Read test_cases.json to see the range of diffs and expected messages
