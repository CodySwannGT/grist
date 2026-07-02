---
title: Personas — instance data for the game-dev persona subagents
category: personas
updated: 2026-07-01
status: scaffold
---

# Personas

This folder holds the **instance data** for the game-development *persona
subagents* shipped by the `lisa-phaser` plugin (`game-designer`,
`player-advocate`, `publisher`, `target-player`, `marketing-strategist`, …).

## The role / instance contract

- **The role lives in Lisa.** The `lisa-phaser` plugin ships genre-neutral
  persona *roles* under its `agents/` directory — reusable across every Phaser
  game. Those subagents know *how* a publisher / game designer / target player
  thinks, and *where to read the specifics*: this wiki.
- **The instance lives here.** The pages in `wiki/personas/**` (plus
  `wiki/design/**`, `wiki/narrative/**`, `wiki/production/**`) are *this game's*
  facts: who it's for, what the publisher constraints are, what the art and
  economy actually are. The subagents read these and critique against them.

If a persona subagent finds these docs missing, it falls back to genre-neutral
best practice and says so. Fill them in to get game-specific critique.

## What's here

| Page | Feeds which subagents |
|------|-----------------------|
| [target-players](target-players.md) | `target-player`, `player-advocate`, `onboarding-advocate`, `ux-ui-designer`, `marketing-strategist` |
| [stakeholders](stakeholders.md) | `publisher`, `marketing-strategist`, `producer`, `monetization-designer` |

> **These pages are scaffold examples** for GRIST. Replace the placeholder
> archetypes and constraints with your real audience and business reality — the
> subagents are only as sharp as this data.
