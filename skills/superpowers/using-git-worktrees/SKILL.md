---
name: using-git-worktrees
description: Set up or verify an isolated Git worktree when the task needs isolation or the user requests it.
---

# Using Git Worktrees

First confirm that the folder is a Git repository, inspect the current branch and uncommitted changes, and determine whether the environment already supplies an isolated worktree. A submodule is not itself proof of a linked worktree.

Use the platform's native isolation mechanism when available and appropriate; otherwise use Git's worktree support with a safe location and branch base consistent with the user's preferences. Check that a project-local worktree directory is ignored before creating it. Preserve all user changes; uncommitted work is not automatically copied to a new worktree.

Do not create a commit merely to prepare an ignored directory. Install dependencies or run a baseline check only if needed for the task, using actual project commands. Report pre-existing failures and the isolation used. Do not remove worktrees or branches, merge, or publish without authorization.
