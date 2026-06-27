---
type: concept
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Game vision

## The pitch

**GRIST** is a slow, grindy JRPG where **Cyberpunk 2077 meets The Lord of the
Rings** — megacorp silicon and chrome grafted onto high fantasy. Neon and ash.
Ancient relics that are also circuitry; magic that is also code.

## Pillars

- **Slow and grindy, on purpose.** The pace is deliberate. Progression is earned
  through patient, systemic grind — the satisfaction is in mastery and
  accumulation, not in being rushed. The name says it: *grist for the mill.*
- **Cyberpunk × high fantasy.** The fusion is the identity, not a coat of paint.
  Corporate dystopia and feudal myth share the same world, the same systems, the
  same aesthetic ambiguity (is it a rune or a chip?).
- **JRPG structure.** Party, turn-based or hybrid combat, deep stat/equipment
  systems, a long campaign. Classic genre bones under the new skin.
- **16-bit craft.** Pixel art and presentation at least as good as the original
  **Final Fantasy VI** — the SNES high-water mark — within the Phaser 4 + Beam
  renderer pipeline.

## Why these constraints matter to the build

The foundation (pure-logic core, determinism, pooling, verification = UAT) is a
good fit for a systemic JRPG: deep, deterministic simulation is exactly what
unit tests and the verification bridge can pin down, and the grindy economy/stat
systems live naturally in `src/logic` with the engine kept thin.

## Open questions

Tracked in [open-questions](../open-questions/) as they come up — combat model
(pure turn-based vs ATB-style hybrid), art production pipeline for FFVI-grade
assets, and the scope of the systemic grind loops.
