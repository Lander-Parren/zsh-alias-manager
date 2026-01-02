---
description: Create a conventional commit, push, and show release PR
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(gh pr list:*), Bash(gh pr view:*)
---

# Conventional Commit & Release

Create a commit following conventional commits format, push to main, and show the release PR.

## Analyze Changes

```bash
git status --short
git diff --staged
```

## Commit Types

| Type | Version Bump | Use For |
|------|--------------|---------|
| `feat:` | Minor (1.0.0 → 1.1.0) | New features |
| `fix:` | Patch (1.0.0 → 1.0.1) | Bug fixes |
| `feat!:` | Major (1.0.0 → 2.0.0) | Breaking changes |
| `chore:` | None | Maintenance, deps |
| `docs:` | None | Documentation |
| `refactor:` | None | Code restructuring |
| `test:` | None | Test changes |

## Format

```
<type>: <description>

[optional body explaining what and why]
```

## Rules

1. Subject line under 50 characters
2. Imperative mood ("add" not "added")
3. Lowercase after colon
4. No period at end

## Task

1. Run `git status` and `git diff --staged` to see changes
2. If nothing staged, ask user what to stage or run `git add -A`
3. Determine the appropriate type based on what changed
4. Write a clear, concise commit message
5. Create the commit:

```bash
git commit -m "<type>: <description>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

6. Push to remote:

```bash
git push
```

7. Wait a few seconds for release-please to run, then show the release PR:

```bash
gh pr list --search "release" --state open
```

8. Show the PR URL to the user so they can merge it to publish.
