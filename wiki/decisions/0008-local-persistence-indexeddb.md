---
type: decision
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# 0008 — Local persistence: IndexedDB

Locked 2026-06-27. Resolves **T4** ([open-questions/register](../open-questions/register.md))
under the local-only/offline constraint ([decisions/0007](0007-local-only-offline.md)).

## Decision

Save data is persisted in **IndexedDB**, accessed through the tiny **`idb`** promise
wrapper (~1 KB), behind the `SaveService` abstraction
([engineering-spec](../architecture/engineering-spec.md)). Specifically:

- **Saves** (party, inventory, world state, quests, ledger, factions, seed) → IndexedDB
  object store, keyed by **slot** (multiple slots + autosave), **versioned with
  migrations**.
- **Settings** (small, needed synchronously at boot) → `localStorage` is acceptable for
  fast sync reads; saves never use it.
- **Request `navigator.storage.persist()`** so the browser won't evict saves under
  storage pressure — critical for a local-only game (eviction = lost playthrough).
- **Export/import** saves as a JSON file for user backup (no cloud;
  [technical-requirements](../architecture/technical-requirements.md)).

This upgrades the starter's `localStorage`-based `SaveService`.

## Why (for this stack)

- **The save is a serialized snapshot, not a queryable DB.** The in-memory sim is the
  source of truth; content is compile-time **TS modules**
  ([decisions/0006](0006-phase-1-technical-decisions.md)). SQL's advantage never applies.
- **Universal on our exact targets** — evergreen browsers, **iOS Safari, Android
  Chrome** — where OPFS/WASM-SQLite support is newer and riskiest (notably iOS)
  ([platform-and-target](../production/platform-and-target.md)).
- **Bundle budget is a hard NFR** ([technical-requirements](../architecture/technical-requirements.md)):
  SQLite-WASM adds ~0.5–1 MB+; IndexedDB is built-in and `idb` is ~1 KB.
- **Simplicity & resilience** — async, large quota, structured storage; fewer
  offline-failure modes.

## Alternatives considered

- **SQLite-in-browser (wa-sqlite / OPFS)** — rejected: bundle weight, OPFS/iOS support
  risk, and runtime SQL querying we don't need.
- **localStorage as primary** — rejected: ~5 MB cap, synchronous/blocking, string-only;
  fine only for tiny settings.
- **Dexie (IndexedDB ORM)** — rejected: heavier than needed; `idb` covers our
  key→object slot model with minimal footprint (revisit only if we outgrow it).

## Consequences

- `SaveService` swaps its backend to IndexedDB (via `idb`); the public API (load/save/
  list-slots/export/import) stays engine-agnostic.
- Add a storage-persistence request at boot; handle quota/denied gracefully (fail safe,
  never crash).
- One small dependency (`idb`) added — justified against the bundle budget.
