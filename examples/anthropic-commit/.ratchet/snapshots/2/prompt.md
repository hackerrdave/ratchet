Based on the following changes, write a commit message in conventional commit format.

Analyze the diff to understand:
1. What was removed and what was added
2. The intent behind the change (bug fix, new feature, code quality improvement, etc.)
3. Why this change matters

**Select the commit type first:**
- `feat`: New functionality or API additions
- `fix`: Bug fixes or security corrections
- `refactor`: Code restructuring without behavior change
- `perf`: Performance improvements
- `docs`: Documentation additions/updates
- `test`: New test files or test additions
- `chore`: Dependency updates, config changes
- `ci`: CI/CD pipeline changes
- `style`: Formatting, linting (no logic change)
- `build`: Build system changes

Then write a single-line commit message with format: `type: description`

Rules:
- Keep under 72 characters total
- Include "why" context only if it clarifies the intent (e.g., "fix: correct token check by converting seconds to milliseconds")
- Output only the commit message, no explanation

{{diff}}