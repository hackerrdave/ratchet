# Goal
Improve the email subject line prompt to generate high-impact, concise subject lines that match the tone and intent of the email body.

# Prompt
prompt.md

# Constraints
- Must keep the {{body}} and {{audience}} placeholders
- Must output only the subject line, no explanation
- Must be under 60 characters
- Must not use ALL CAPS or excessive punctuation (!!!, ???)
- Must not use spammy words like "FREE", "ACT NOW", "URGENT"

# Eval
- Test cases: test_cases.json
- Target: claude-haiku-4-5-20251001
- Accurately captures the core message of the email body (35%)
- Appropriate tone for the specified audience (25%)
- Concise — under 60 characters, every word earns its place (20%)
- Would compel the recipient to open the email (20%)

# Context
- Read test_cases.json to see the variety of email types and audiences
