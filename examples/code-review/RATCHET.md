# Goal
Improve the code review prompt to generate specific, actionable, and constructive review comments from code diffs — like a senior engineer would write.

# Prompt
prompt.md

# Constraints
- Must keep the {{diff}} and {{context}} placeholders
- Must focus on substantive issues — no style nitpicks unless they affect readability
- Must reference specific lines or patterns from the diff
- Must suggest concrete fixes, not vague advice
- Must stay under 200 words per review

# Eval
- Test cases: test_cases.json
- Target: claude-haiku-4-5-20251001
- Identifies the most important issue in the diff (35%)
- Provides a specific, actionable suggestion with code or pseudocode (25%)
- Constructive tone — respectful, explains the "why" (20%)
- Concise — focuses on what matters, no fluff (20%)

# Context
- Read test_cases.json to see the variety of code patterns and expected feedback
