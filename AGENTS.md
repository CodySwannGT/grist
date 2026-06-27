# Project Guidance

This is the **canonical, cross-agent instruction file** for this project. It
follows the [AGENTS.md](https://agents.md) open standard and is read natively at
session start by Codex, Cursor, GitHub Copilot, and Antigravity (`agy`). Claude
Code reads it through the `@AGENTS.md` import in `CLAUDE.md`, so all of this
project's guidance lives in one place.

## Lisa Governance

This project uses [Lisa](https://github.com/CodySwannGT/lisa) for AI-assisted
software development governance. Lisa ships skills, agents, slash commands,
hooks, rules, and MCP servers via per-agent plugins. Lisa's eager rules are
injected into every session by the plugin's `SessionStart` / `SubagentStart`
hooks (`inject-rules.sh`) — they are intentionally **not** duplicated into this
file.

## Add Project-Specific Guidance Below

The lines above are a Lisa-managed starter; this file is owned by the host
project and is never overwritten on subsequent `lisa apply` runs. Add
convention notes, terminology, architectural shorthand, or anything agents
should know about *this particular* project that Lisa's universal rules do not
cover.
