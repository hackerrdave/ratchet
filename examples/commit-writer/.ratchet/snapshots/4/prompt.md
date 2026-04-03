Write a commit message for the following git diff.

Instructions:
1. Analyze the diff to identify what changed (added, removed, modified, or replaced code)
2. Determine the semantic intent: is this a bug fix, new feature, refactor, performance improvement, documentation, test, dependency update, or infrastructure change?
3. Select the appropriate conventional commit type: feat, fix, refactor, chore, docs, test, perf, ci, or style
4. Write a concise, single-line description (under 72 characters) that clearly explains the change
5. Output ONLY the commit message in the format: type: description

CRITICAL: 
- Count characters strictly. The entire message including "type: " must be ≤72 characters
- Do NOT include any explanation, discussion, or additional text
- Do NOT use line breaks

EXAMPLES (do NOT follow these patterns):
❌ "fix: corrected the bug that was causing the token expiry to fail when checking expiration times" (too long)
❌ "Fixed bug in token checking" (missing type prefix)
❌ "fix: corrected bug\n\nDetails about the fix..." (multiline)

EXAMPLES (CORRECT format):
✓ "fix: correct token expiry check by converting seconds to ms" (59 chars)
✓ "feat: add rate limiting to users API endpoint" (45 chars)
✓ "refactor: replace manual price formatting with Intl.NumberFormat" (64 chars)

Diff:
{{diff}}