# Goal
Improve the code review prompt — derived from Anthropic's official claude-plugins-official repo (pr-review-toolkit/agents/code-reviewer.md). Optimize it to catch real bugs, minimize false positives, and provide actionable feedback like a senior engineer.

# Prompt
prompt.md

# Constraints
- Must keep the {{diff}} and {{context}} placeholders
- Must focus on substantive issues — no style nitpicks unless they affect correctness
- Must reference specific lines or patterns from the diff
- Must suggest concrete fixes, not vague advice
- Must stay under 300 words per review
- Must use the confidence scoring system (only report ≥ 80)

# Eval
- Test cases: test_cases.json
- Target: claude-haiku-4-5-20251001
- Identifies the most critical issue in the diff (35%)
- Provides a specific, actionable fix with code or pseudocode (25%)
- Avoids false positives — does not flag non-issues (20%)
- Constructive tone — explains the "why", not just the "what" (10%)
- Appropriate confidence score for the issue severity (10%)

# Context
- Source: https://github.com/anthropics/claude-plugins-official/blob/main/plugins/pr-review-toolkit/agents/code-reviewer.md
- Read test_cases.json to understand the range of bugs and code patterns
