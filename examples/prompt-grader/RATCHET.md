# Goal
Improve the sentiment classification prompt to maximize accuracy, valid JSON output, and proper confidence scores across diverse product reviews.

# Prompt
prompt.md

# Constraints
- Must keep the {{review}} placeholder
- Must request JSON output with "sentiment" and "confidence" fields
- Must classify as exactly one of: positive, negative, neutral
- Must remain under 500 tokens

# Eval
- Test cases: test_cases.json
- Target: claude-haiku-4-5-20251001
- Correct sentiment classification (70%)
- Valid JSON output (15%)
- Valid confidence score between 0 and 1 (15%)

# Context
- Read test_cases.json to understand the test data
