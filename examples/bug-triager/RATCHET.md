# Goal
Improve the bug triage prompt to accurately classify bug reports by severity, affected component, and actionable next steps — like an experienced SRE would triage.

# Prompt
prompt.md

# Constraints
- Must keep the {{report}} placeholder
- Must output valid JSON with fields: severity, component, summary, next_steps
- Severity must be one of: critical, high, medium, low
- Summary must be one sentence, under 100 characters
- next_steps must be an array of 1-3 concrete actions

# Eval
- Test cases: test_cases.json
- Target: claude-haiku-4-5-20251001
- Correct severity classification (30%)
- Correct component identification (20%)
- Accurate one-line summary (20%)
- Actionable, specific next steps (15%)
- Valid JSON output matching the schema (15%)

# Context
- Read test_cases.json to see the range of bug reports
