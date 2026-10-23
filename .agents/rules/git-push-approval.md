# Git Push Confirmation Rule

Before executing any `git push` command to any remote repository:
1. **NEVER push directly** without explicit confirmation from the user.
2. Always present the user with:
   - The branch name.
   - The commit summary/hashes being pushed.
   - The exact command intended to run.
3. Wait for the user to explicitly confirm before running `git push`.
