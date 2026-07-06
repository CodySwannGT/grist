/**
 * The authored **moral-ledger codex catalog** (sub-task #221, Story #196 / #99, PRD
 * #42): the content-as-data map from each recordable moral-choice flag → its display
 * title and recorded line, in the story's authored order. This is the *content* half
 * of the Ledger codex panel; the pure projection that tags each entry recorded/pending
 * against a live {@link NarrativeLedger} is `logic/narrative`'s
 * {@link projectLedgerCodex}. Strings live here — the codebase's typed-consts idiom —
 * so the panel resolves every label through this catalog and hardcodes none (grist has
 * no i18n runtime; this catalog is that convention's equivalent, per the parent story).
 *
 * **Which flags.** Each entry keys off a named {@link NarrativeLedger} flag: the Ch.1
 * Sable reveal ({@link SABLE_REVEALED_FLAG}), Wren's "What the mill took" render-or-not
 * beat, the Reckoning's Sable-lost turn ({@link SABLE_LOST_FLAG}, shipped with #125 /
 * PR #220), and the four Act II reunions (their persisted `reunion:<id>` status flags).
 * The catalog *lists* every such choice so the codex shows it recorded-or-pending; a
 * beat's own persistence — writing its flag into the ledger the panel reads
 * (`save.scene.flags`) — is that beat's concern (the moral-ledger data model / flag
 * writing is #98 / #116, out of this panel's scope). The mill beat records its choice
 * through the persisted `MoralLedger` today (see `logic/side-story/mill`); its codex
 * row keys off the {@link MILL_RENDERED_FLAG} narrative flag reserved for it here, so
 * the choice reads recorded once that flag rides the ledger.
 *
 * The pre-Reckoning `reckoning:roster-before` flag is deliberately **excluded**: it is
 * roster bookkeeping (a serialized survivor list), not a player moral choice.
 * @module content/ledger-codex
 */
import type { LedgerCodexEntry } from "../logic/narrative";
import type { SceneFlag } from "../logic/narrative";
import { SABLE_LOST_FLAG } from "../logic/narrative";
import { ReunionStatuses } from "../logic/party/reunion";
import { SABLE_REVEALED_FLAG } from "./scenes/ch1";
import { ReunionIds, type ReunionId } from "./reunions";

/**
 * The narrative-flag key reserved for Wren's mill **render-or-not** beat (#111). The
 * beat's persisted moral consequence rides the `MoralLedger` today; this is the codex's
 * stable key for the choice so its row records once the flag is folded into the ledger.
 */
export const MILL_RENDERED_FLAG = "mill-rendered";

/**
 * The scene-flag key prefix each reunion's persisted status is stored under — mirrors
 * the (module-private) prefix `logic/party/reunion` writes via `reunionStatusFlags`, so
 * a reunion's codex row keys off the exact `reunion:<id>` flag the save carries.
 */
const REUNION_FLAG_PREFIX = "reunion:";

/**
 * A reunion is *recorded* only when its tri-state status flag reads `completed` (the
 * companion was reunited) — an `available` (not yet resolved) or `missed` (sealed)
 * status stays pending. The per-entry predicate the projection applies.
 * @param value - The reunion's persisted status flag value.
 * @returns True when the reunion was completed.
 */
function reunionCompleted(value: SceneFlag): boolean {
  return value === ReunionStatuses.completed;
}

/**
 * One reunion codex entry: keyed off its `reunion:<id>` status flag, recorded only on
 * `completed`. A tiny factory so the four entries share one shape and the flag key is
 * derived from the id (never drifts).
 * @param id - The reunion id.
 * @param title - The codex display title.
 * @param recordedLine - The line shown once the reunion is completed.
 * @returns The catalog entry.
 */
function reunionEntry(
  id: ReunionId,
  title: string,
  recordedLine: string
): LedgerCodexEntry {
  return {
    id: `${REUNION_FLAG_PREFIX}${id}`,
    flag: `${REUNION_FLAG_PREFIX}${id}`,
    title,
    recordedLine,
    isRecorded: reunionCompleted,
  };
}

/**
 * The authored codex catalog, in story order: the Ch.1 reveal, Wren's mill beat, the
 * Reckoning's Sable-lost turn, then the four Act II reunions. This array IS the
 * `M`-entry contract the codex tally (`Recorded: N of M`) and the "lists every choice
 * in authored order" acceptance criterion assert.
 */
export const LEDGER_CODEX_CATALOG: readonly LedgerCodexEntry[] = [
  {
    id: SABLE_REVEALED_FLAG,
    flag: SABLE_REVEALED_FLAG,
    title: "The Delivery",
    recordedLine: "You pried the cargo open — and found Sable inside.",
  },
  {
    id: MILL_RENDERED_FLAG,
    flag: MILL_RENDERED_FLAG,
    title: "What the Mill Took",
    recordedLine: "At the rendering-mill, you faced Lira's lever — and chose.",
  },
  {
    id: SABLE_LOST_FLAG,
    flag: SABLE_LOST_FLAG,
    title: "The Reckoning",
    recordedLine: "When the world tipped to ash, Sable was taken from you.",
  },
  reunionEntry(
    ReunionIds.quietus,
    "The Ghost in the Vault",
    "You found Quietus in the dark and brought them home."
  ),
  reunionEntry(
    ReunionIds.asch,
    "Ash and Asch",
    "You reached Asch across the ashfall and stood together again."
  ),
  reunionEntry(
    ReunionIds.cal,
    "The Long Way to Cal",
    "You tracked Cal down and closed the distance the sundering opened."
  ),
  reunionEntry(
    ReunionIds.shrike,
    "Shrike's Debt",
    "You settled things with Shrike and drew them back to the party."
  ),
];

/**
 * The authored codex catalog size (`M`) — the number of moral choices the codex lists.
 * A named constant so tests and readers name the contract, not a magic length.
 */
export const LEDGER_CODEX_TOTAL = LEDGER_CODEX_CATALOG.length;
