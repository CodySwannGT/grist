/**
 * The data-cell slice of the verification (UAT) bridge — the scene-agnostic
 * `window.__VERIFY__` entry points backed by the bridge-held *data* cells
 * (save / world-state / run-state / region-data / enemy-family / bound-site),
 * extracted from `uat/bridge.ts` the same way the field / bench / dialogue /
 * region-scene seams are (keeping the bridge under its line budget). These cells hold
 * pure test state — no Phaser, no gameplay objects — so an e2e can persist + reload a
 * save, flip the world-state, read a template-authored region / enemy-family, and
 * make a region's Bound-site free-vs-wield choice (#135) scene-agnostically, without a
 * live scene attached.
 * @module uat/data-cell-api
 */
import { type ShardMode } from "../logic/save/types";
import { type CurrentSave } from "../logic/save";
import { type WorldState } from "../logic/world";
import { saveService } from "../services/save-service";
import { BoundSiteCell, type VerifyBoundSiteState } from "./bound-site-cell";
import {
  DefectionCell,
  type OpenDefectionOptions,
  type VerifyDefectionState,
} from "./defection-cell";
import {
  EncounterLadderCell,
  type VerifyEncounterLadderState,
} from "./encounter-ladder-cell";
import { EnemyCell, type VerifyEnemyState } from "./enemy-cell";
import { MillBeatCell, type VerifyMillBeatState } from "./mill-beat-cell";
import { RegionCell, type VerifyRegionState } from "./region-cell";
import {
  RequiemHallCell,
  type OpenRequiemHallOptions,
  type VerifyRequiemHallState,
} from "./requiem-hall-cell";
import { RunStateCell, type VerifyRunState } from "./run-state-cell";
import { type MillDecision } from "../logic/side-story/mill";
import { TravelCell, type VerifyTravelState } from "./travel-cell";
import { WalletCell } from "./wallet-cell";
import { WorldStateCell } from "./world-state-cell";

/**
 * The bridge-held world-state cell (#134): the world-state flag the e2e flips and
 * reads lives here in memory (flip + resolve semantics delegated to `logic/world`),
 * while the canonical flag still rides the persisted save. A module singleton — a
 * pure test seam, not gameplay state.
 */
const worldStateCell = new WorldStateCell();

/**
 * The bridge's single shared grist wallet (#136 contract): the one live balance both
 * the run-state read (`runState().grist`, #88) and the travel cell's fast-travel
 * spend draw on, so a hop visibly decreases the same wallet the run-state reports.
 * Seeded from a persisted save's grist on adopt; reset to the slice default on
 * `clearSave`.
 */
const walletCell = new WalletCell();

/**
 * The bridge-held run-state cell (#88): the resolved free-vs-wield choice, the moral
 * ledger, the learning progression, and the shared grist wallet (read live from the
 * shared {@link walletCell}, not a private copy), so the slice e2e can read them
 * scene-agnostically.
 */
const runStateCell = new RunStateCell(walletCell);

/**
 * The bridge-held region cell (#133): a region authored against the `RegionDef`
 * template, read through the live world-state flag, so the region e2e can load a
 * region and observe its both-states variants scene-agnostically.
 */
const regionCell = new RegionCell();

/**
 * The bridge-held enemy-family cell (#138): a family authored against the
 * `EnemyFamilyDef` schema, read per-region through the live world-state flag, so the
 * enemy-family e2e can load a family and observe its Reach block warp to Ashfall.
 */
const enemyCell = new EnemyCell();

/**
 * The bridge-held encounter-ladder cell (#108): the Phase-3 escalating ATB encounter
 * ladder authored against the existing {@link import("../content").EncounterDef}
 * schema, read straight from the shipped content tables, so the escalation e2e can
 * confirm ≥4 distinct encounters and strictly-increasing difficulty scene-agnostically
 * on the live built game — running entirely on the reused Phase-2 sim's data.
 */
const encounterLadderCell = new EncounterLadderCell();

/**
 * The bridge-held Bound-site cell (#135): a region's single Bound site anchored
 * through the Bound-site template and resolved with the Phase-2 free-vs-wield kit,
 * so the Bound-site e2e can reach a site, choose free/wield, and observe the
 * diverging karma/corruption scene-agnostically. The persistence-across-reload half
 * rides the existing save path (the e2e persists the settled choice + reloads).
 */
const boundSiteCell = new BoundSiteCell();

/**
 * The bridge-held mill-beat cell (#111): Wren's "What the mill took" side-story beat
 * and its render-or-not choice, resolved through `logic/side-story/mill` (which folds
 * the persisted free-vs-wield {@link MoralLedger}), so the side-mill e2e can reach the
 * beat, choose render/spare, observe the diverging persisted karma/tally
 * scene-agnostically, and persist+reload the save it projects (the AC's
 * save/reload-survival half rides the existing save path → `runState().moralLedger`).
 */
const millBeatCell = new MillBeatCell();

/**
 * The bridge-held requiem-hall cell (#145): the Sidhe requiem-hall Ch.4 set-piece,
 * gated by the Roots Bound (Velith) attunement and played through the pure set-piece
 * logic in `logic/region`, so the Ch.4 e2e can reach + play the requiem-hall to
 * completion (and observe the soft-gate when the prerequisites are unmet)
 * scene-agnostically, without a live scene attached.
 */
const requiemHallCell = new RequiemHallCell();

/**
 * The bridge-held defection cell (#146): Halcyon's Ch.4 defection + party expansion,
 * gated on the Sidhe requiem-hall (#145) reaching its `truth` beat and recruited
 * through the pure defection reducer in `logic/party`, so the defection e2e can reach
 * the trigger, fire it, read the expanded active party roster (with Halcyon's authored
 * stats + kit), and persist/reload it through the existing save path —
 * scene-agnostically, without a live scene attached.
 */
const defectionCell = new DefectionCell();

/**
 * The bridge-held travel cell (#136): the earned-freedom mobility chain (foot →
 * skiff → airship → fast-travel) and its capability/knowledge soft-gate live here in
 * memory (tier / gate / fast-travel semantics delegated to `logic/travel`), so the
 * traversal e2e can earn tiers, discover safehouses, and fast-travel — observing the
 * grist deduction from the shared wallet and the determinism digest —
 * scene-agnostically, without a live scene attached. Spends grist through the shared
 * {@link walletCell} (never a private wallet), so a hop draws down the same balance
 * `runState().grist` reports.
 */
const travelCell = new TravelCell(walletCell);

/**
 * Adopt a {@link CurrentSave} into the bridge-held world-state + run-state cells so
 * the in-memory read paths (`worldState` / `reckon` / `regionTone` / `runState`)
 * reflect it — the single sync point shared by a successful persist and a reload.
 * @param save - The save whose sub-shapes the cells adopt.
 * @returns void
 */
function adoptIntoCells(save: CurrentSave): void {
  worldStateCell.adopt(save.worldState);
  // runStateCell.adopt seeds the single shared wallet from save.grist, so the
  // run-state read and the travel spend both observe the save's grist (and any later
  // draw-down) — one shared wallet, seeded in one place.
  runStateCell.adopt(save);
  // defectionCell.adopt rebuilds its held roster from save.party, so a reload's
  // loadSave() rehydrates the defection read to the *restored* roster (Halcyon with her
  // live stats + kit), not the fresh starting party — the hydration path the e2e
  // asserts after reload (#146).
  defectionCell.adopt(save);
}

/**
 * Persist a {@link CurrentSave} through the real shared {@link saveService} (the
 * `__VERIFY__.save` driver). The cells are adopted **only after** the IndexedDB write
 * commits, so a failed save never leaves the in-memory read paths claiming a state
 * that storage does not hold (the cells stay synchronized with the storage
 * lifecycle). Resolves false if persistence is unavailable.
 * @param save - The save payload to persist (and adopt on success).
 * @returns True once the write commits, false on failure.
 */
async function persistSave(save: CurrentSave): Promise<boolean> {
  try {
    await saveService.save(save);
    adoptIntoCells(save);
    return true;
  } catch {
    return false;
  }
}

/**
 * Restore the persisted save from IndexedDB (the post-reload read) AND rehydrate the
 * bridge-held cells from it, so `worldState()` / `runState()` agree with what
 * `loadSave()` returns after a reload (no stale verification state leaks across the
 * document boundary). Returns the restored save (a fresh save when nothing is stored).
 * @returns The restored {@link CurrentSave}.
 */
async function loadAndRehydrate(): Promise<CurrentSave> {
  const save = await saveService.load();
  adoptIntoCells(save);
  return save;
}

/**
 * Delete the persisted save from IndexedDB AND clear the bridge-held cells, so a
 * reset leaves the in-memory read paths null (matching `hasSave()` → false) rather
 * than holding the just-cleared state. Keeps the cells synchronized with the storage
 * lifecycle on the clear path.
 * @returns void
 */
async function clearAndReset(): Promise<void> {
  await saveService.clear();
  worldStateCell.reset();
  runStateCell.reset();
  // Reset the defection cell back to the fresh starting party alongside the others so
  // a clearSave leaves defection() reading [wren, tobi], not a stale recruited roster.
  defectionCell.reset();
  travelCell.reset();
  // Reset the shared wallet to the slice default alongside the travel cell so both
  // halves of the run return to a known origin together.
  walletCell.reset();
}

/** The data-cell slice of the verification API spread into `window.__VERIFY__`. */
export interface DataCellApi {
  /** Persist a {@link CurrentSave} to IndexedDB via the real save service. */
  readonly save: (save: CurrentSave) => Promise<boolean>;
  /** Restore the persisted save from IndexedDB (the post-reload read). */
  readonly loadSave: () => Promise<CurrentSave>;
  /** Whether a save record is present in IndexedDB. */
  readonly hasSave: () => Promise<boolean>;
  /** Delete the persisted save (reset between e2e runs). */
  readonly clearSave: () => Promise<void>;
  /** The bridge-held current world-state, or null if none has been adopted. */
  readonly worldState: () => WorldState | null;
  /** Apply the Reckoning flip to the bridge-held world-state (reach → ashfall). */
  readonly reckon: () => void;
  /** The region tone resolved through the live world-state flag, or null. */
  readonly regionTone: () => string | null;
  /** Load the canonical example region authored against the template. */
  readonly loadRegion: () => void;
  /** The loaded region resolved through the live world-state, or null. */
  readonly region: () => VerifyRegionState | null;
  /** Load the canonical example enemy family authored against the schema. */
  readonly loadEnemy: () => void;
  /** The loaded family's region block resolved through the live world-state, or null. */
  readonly enemy: () => VerifyEnemyState | null;
  /**
   * A snapshot of the Phase-3 escalating ATB encounter ladder (#108): the run's
   * ≥4 distinct encounters, their per-rung difficulty scores, and the
   * strictly-escalating verdict — read straight from the shipped content tables, so
   * the escalation e2e can prove the AC on the live built game with no scene live.
   */
  readonly encounterLadder: () => VerifyEncounterLadderState;
  /** The bundled run-state snapshot (choice + karma + learning + wallet), or null. */
  readonly runState: () => VerifyRunState | null;
  /**
   * Anchor a region's single Bound site through the template (#135). Defaults to the
   * canonical `marrow` region; pass `regionId: "roots"` to open Velith the
   * Deep-bound's site (#144). An unknown id falls back to `marrow`.
   */
  readonly openBoundSite: (regionId?: string) => void;
  /** Commit the free-vs-wield choice at the opened Bound site (`free` / `wield`). */
  readonly chooseBound: (mode: ShardMode) => void;
  /** The opened/settled Bound-site snapshot (shard + variant + karma + corruption), or null. */
  readonly boundSite: () => VerifyBoundSiteState | null;
  /** Reach Wren's "What the mill took" side-story beat, opening its render-or-not choice (#111). */
  readonly openMill: () => void;
  /** Commit the render-or-not choice at the opened mill beat (`render` / `spare`) (#111). */
  readonly chooseMill: (decision: MillDecision) => void;
  /** The opened/settled mill-beat snapshot (shard + variant + persisted karma + corruption), or null. */
  readonly millBeat: () => VerifyMillBeatState | null;
  /** Project the settled mill choice into a CurrentSave the `save` path persists (#111). */
  readonly millSave: () => CurrentSave;
  /**
   * Open the Sidhe requiem-hall Ch.4 set-piece (#145). Defaults to the Roots region
   * with the Ch.4 prerequisites met (Velith freed) in Act I `reach`; pass
   * `{ withVelith: false }` to open the soft-gated (unreachable) hall, or
   * `mode`/`worldState`/`seed` to vary the fork.
   */
  readonly openRequiemHall: (
    regionId?: string,
    options?: OpenRequiemHallOptions
  ) => void;
  /** Advance the requiem-hall set-piece one authored beat (no-op when gated/complete). */
  readonly playRequiemHall: () => void;
  /** Drive the requiem-hall set-piece to its terminal phase (no-op when gated). */
  readonly playRequiemHallToCompletion: () => void;
  /** The requiem-hall snapshot (reachability + beat + phase + completion + hash), or null. */
  readonly requiemHall: () => VerifyRequiemHallState | null;
  /**
   * Open Halcyon's defection requiem-hall in the Roots / the Deep (#146). Defaults to
   * a Ch.4-ready run (Velith attuned); pass `{ withVelith: false }` to open the
   * soft-gated hall so firing too early never recruits her.
   */
  readonly openDefection: (options?: OpenDefectionOptions) => void;
  /** Drive the defection's requiem to its `truth` beat (the trigger; no-op when gated). */
  readonly playDefectionRequiem: () => void;
  /** Fire Halcyon's defection (no-op before the requiem truth, or once she has joined). */
  readonly fireDefection: () => void;
  /** The defection snapshot (the active roster with stats + kit, and whether Halcyon joined). */
  readonly defection: () => VerifyDefectionState;
  /** Project the post-defection roster into a CurrentSave the `save` path persists. */
  readonly defectionSave: () => CurrentSave;
  /** Earn the skiff (foot → skiff), opening regional travel (#136). */
  readonly earnSkiff: () => void;
  /** Earn the airship (skiff → airship), opening the full Reach and fast-travel (#136). */
  readonly earnAirship: () => void;
  /** Record a discovered safehouse (knowledge) for fast-travel (#136). */
  readonly discoverSafehouse: (safehouse: string) => void;
  /** Fast-travel between two discovered safehouses; returns the grist spent (0 if refused). */
  readonly fastTravel: (from: string, to: string) => number;
  /** The travel snapshot (tier + soft-gate + knowledge + grist + determinism hash). */
  readonly travel: () => VerifyTravelState;
}

/**
 * Build the data-cell slice of the verification API, bound to the module-singleton
 * data cells. Spread into `window.__VERIFY__` by the bridge so the save / world-state
 * / region-data / enemy-family entry points live next to the cells they drive — the
 * same `dialogueApi(...)` split that keeps `uat/bridge.ts` under its line budget. The
 * region/enemy reads resolve through the live world-state flag (default Act I `reach`
 * until a save adopts or `reckon()` flips one).
 * @returns The data-cell verification API slice.
 */
export function dataCellApi(): DataCellApi {
  return {
    save: (save: CurrentSave) => persistSave(save),
    loadSave: () => loadAndRehydrate(),
    hasSave: () => saveService.has(),
    clearSave: () => clearAndReset(),
    worldState: () => worldStateCell.read(),
    reckon: () => worldStateCell.reckon(),
    regionTone: () => worldStateCell.regionTone(),
    loadRegion: () => regionCell.load(),
    region: () => regionCell.snapshot(worldStateCell.read() ?? "reach"),
    loadEnemy: () => enemyCell.load(),
    enemy: () => enemyCell.snapshot(worldStateCell.read() ?? "reach"),
    encounterLadder: () => encounterLadderCell.snapshot(),
    runState: () => runStateCell.snapshot(),
    openBoundSite: (regionId?: string) => boundSiteCell.open(regionId),
    chooseBound: (mode: ShardMode) => boundSiteCell.choose(mode),
    boundSite: () => boundSiteCell.snapshot(),
    openMill: () => millBeatCell.open(),
    chooseMill: (decision: MillDecision) => millBeatCell.choose(decision),
    millBeat: () => millBeatCell.snapshot(),
    millSave: () => millBeatCell.toSave(),
    openRequiemHall: (regionId?: string, options?: OpenRequiemHallOptions) =>
      requiemHallCell.open(regionId, options),
    playRequiemHall: () => requiemHallCell.play(),
    playRequiemHallToCompletion: () => requiemHallCell.playToCompletion(),
    requiemHall: () => requiemHallCell.snapshot(),
    openDefection: (options?: OpenDefectionOptions) =>
      defectionCell.openRequiem(options),
    playDefectionRequiem: () => defectionCell.playRequiemToTruth(),
    fireDefection: () => defectionCell.fireDefection(),
    defection: () => defectionCell.snapshot(),
    defectionSave: () => defectionCell.toSave(),
    earnSkiff: () => travelCell.earnSkiff(),
    earnAirship: () => travelCell.earnAirship(),
    discoverSafehouse: (safehouse: string) => travelCell.discover(safehouse),
    fastTravel: (from: string, to: string) => travelCell.fastTravel(from, to),
    travel: () => travelCell.snapshot(),
  };
}
