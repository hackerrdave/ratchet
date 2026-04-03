# Goal
Improve the commit message prompt — originally from Anthropic's official claude-plugins-official repo (commit-commands plugin). The starting prompt is intentionally bare to show how much ratchet can improve a real-world prompt.

# Prompt
prompt.md

# Constraints
- Must keep the {{diff}} placeholder
- Must output only the commit message, no explanation or commentary
- Must use conventional commit format (type: description)
- Valid types: feat, fix, refactor, chore, docs, test, perf, ci, style, build
- Single line, no multi-line body unless the diff is extremely complex

# Eval
- Test cases: test_cases.json
- Target: claude-haiku-4-5-20251001
- Correct commit type selected (30%)
- Accurately describes what changed and why (40%)
- Conventional commit format with no extra text (15%)
- Concise — single line, under 72 characters (15%)

# Context
- Source: https://github.com/anthropics/claude-plugins-official/blob/main/plugins/commit-commands/commands/commit.md
- Read test_cases.json to see the range of diffs and expected messages
