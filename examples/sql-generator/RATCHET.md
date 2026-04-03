# Goal
Improve the natural language to SQL translation prompt to generate correct, efficient SQL queries from plain English questions.

# Prompt
prompt.md

# Constraints
- Must keep the {{question}} and {{schema}} placeholders
- Must output only the SQL query, no explanation or commentary
- Must generate valid PostgreSQL syntax
- Must not use SELECT * — always specify columns

# Eval
- Test cases: test_cases.json
- Target: claude-haiku-4-5-20251001
- Correct SQL logic — returns the right data (40%)
- Valid PostgreSQL syntax (20%)
- Efficient query — uses appropriate JOINs, avoids subqueries when unnecessary (20%)
- Clean formatting — readable, properly aliased (10%)
- Handles edge cases mentioned in the question like NULLs, duplicates (10%)

# Context
- Read test_cases.json to see the range of questions and expected SQL
