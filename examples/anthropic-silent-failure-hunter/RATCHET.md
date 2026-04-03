# Goal
Improve the silent failure detection prompt — derived from Anthropic's official claude-plugins-official repo (pr-review-toolkit/agents/silent-failure-hunter.md). Optimize it to catch real error handling problems, correctly classify severity, and suggest specific fixes.

# Prompt
prompt.md

# Constraints
- Must keep the {{code}} and {{context}} placeholders
- Must use the severity levels: CRITICAL, HIGH, MEDIUM
- Must reference specific locations in the code
- Must provide concrete fix code, not vague suggestions
- Must not flag proper error handling as a problem (no false positives)
- Must identify ALL silent failure patterns, not just the most obvious one

# Eval
- Test cases: test_cases.json
- Target: claude-haiku-4-5-20251001
- Correctly identifies all silent failure patterns in the code (35%)
- Appropriate severity classification for each issue (20%)
- Provides specific, correct fix code for each issue (20%)
- No false positives — does not flag proper error handling (15%)
- Lists hidden error types that could be masked (10%)

# Context
- Source: https://github.com/anthropics/claude-plugins-official/blob/main/plugins/pr-review-toolkit/agents/silent-failure-hunter.md
- Read test_cases.json to understand the variety of error handling patterns
