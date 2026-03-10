# Goal
Improve the sentiment classification prompt to maximize accuracy, valid JSON output, and proper confidence scores across diverse product reviews.

# Lever
The file at examples/prompt-grader/prompt.md is the only thing you may change.
One targeted improvement per iteration. Do not rewrite wholesale.

# Constraints
- Must keep the {{review}} placeholder
- Must request JSON output with "sentiment" and "confidence" fields
- Must classify as exactly one of: positive, negative, neutral
- Must remain under 500 tokens

# Context
- Read examples/prompt-grader/test_cases.json to understand the test data
- The scorer measures sentiment accuracy (70%), valid JSON (15%), and valid confidence 0-1 (15%)
