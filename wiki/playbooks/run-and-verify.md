---
type: playbook
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Run and verify

## Run it

```bash
bun install
bun run dev          # http://localhost:5173 — play the game
bun run build        # production build
bun run lint         # all enforced rules
bun run typecheck    # strict tsc
bun run test         # pure-logic unit tests (tests/logic)
bun run test:e2e     # Playwright verification suite (tests/e2e)
```

## Verification IS UAT (definition of done)

Nothing is "done" until an agent has **played the running game** and confirmed
the bug is fixed / the feature meets its acceptance criteria. This is the same
gate Lisa enforces via the verification Stop hook and CI coverage check — there
is no separate "UAT" step.

### The loop

1. **State acceptance criteria** for the ticket (what a player must be able to
   do/see).
2. **Build it**, keeping rules in `src/logic` and adapters thin.
3. **Play it.** Run `bun run dev` and drive the game. For deterministic,
   repeatable runs use the bridge: open with `?uat=1` and use
   `window.__VERIFY__` to `seed(...)`, read `state`, `setIntent(...)` /
   `clearIntent()`.
4. **Capture evidence** under `evidence/<ticket>/` (screenshots/recording +
   notes) and reference it with an `[EVIDENCE:<name>]` marker.
5. **Lock it in CI.** Add/extend a `tests/e2e/*.spec.ts` spec so the behavior
   re-runs on every PR. The verification coverage check fails the build if a
   change lacks evidence and isn't explicitly `verification-exempt` (logged,
   never silent).

### The verification bridge

`src/uat/bridge.ts` exposes `window.__VERIFY__` only when the page is loaded
with `?uat=1`:

- `seed(n)` — reseed the RNG for a reproducible run
- `state` — read the current sim state (status, score, items, …)
- `setIntent(intent)` / `clearIntent()` — inject input without the keyboard

This is the contract the Playwright suite uses; keep it stable.
