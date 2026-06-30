/**
 * The verification bridge's enemy-family cell (#138) — a tiny in-memory holder the
 * `__VERIFY__` bridge owns so the enemy-family e2e can load a family authored
 * against the {@link EnemyFamilyDef} schema and observe its per-region stat block
 * resolved through the live world-state flag, scene-agnostically. The cell only
 * *holds* the loaded family and reads it *through* a world-state; all family-tag +
 * both-states validation + resolve *semantics* live in `content/enemies` (which
 * delegates to `logic/world`), so the bridge never re-implements the rules.
 *
 * Mirrors `uat/region-cell.ts`: extracted from `uat/bridge.ts` so the bridge stays
 * under its line budget and the family seam is independently readable. Zero Phaser,
 * no I/O, no RNG.
 * @module uat/enemy-cell
 */
import {
  ENEMY_FAMILIES,
  RegisteredFamilyIds,
  isCompleteEnemyFamily,
  isEnemyFamily,
  resolveFamilyStatBlock,
  validateEnemyFamily,
  type AshfallVariant,
  type EnemyFamilyDef,
  type RegionStatBlock,
} from "../content";
import { type WorldState } from "../logic/world";

/** The region the canonical example family (`marrow-gangs`) is read through. */
const MARROW_REGION = "marrow";

/**
 * A resolved per-region block read through the world-state flag: the Reach stat
 * block before the Reckoning, the warped Ashfall variant after, or null when the
 * family has no entry for the region. The return shape of
 * {@link resolveFamilyStatBlock} the cell narrows on.
 */
type ResolvedBlock = RegionStatBlock | AshfallVariant | null;

/**
 * A read-only snapshot of a loaded family's region block resolved through a
 * world-state — the shape the family e2e asserts on. Carries the family id + tag
 * validity, the live world-state, the region read, the resolved block's loot, its
 * drained-palette marker (only set in Ashfall), whether it gained a Gloom attack
 * (only in Ashfall), whether the family passed schema validation, and a stable
 * determinism hash. `isAshfall` distinguishes the warped read from the Reach read
 * so the e2e can prove the variant differs across the flip.
 */
export interface VerifyEnemyState {
  readonly id: string;
  readonly knownTag: boolean;
  readonly worldState: WorldState;
  readonly region: string;
  readonly isAshfall: boolean;
  readonly lootGrist: number;
  readonly drainedPalette: string | null;
  readonly gloomAttacks: readonly string[];
  readonly complete: boolean;
  readonly errors: readonly string[];
  /** A stable digest of the resolved block for the determinism gate. */
  readonly hash: string;
}

/**
 * Stable FNV-1a digest of a loaded family's resolved region block — the family
 * analogue of the region state-hash. Same world-state + same family + same region
 * ⇒ identical digest, so the e2e can assert reproducibility without a battle scene.
 * Pure: a total function of its inputs.
 * @param family - The loaded family.
 * @param region - The region key the block is read for.
 * @param state - The world-state to resolve through.
 * @returns An 8-char hex digest.
 */
function hashFamily(
  family: EnemyFamilyDef,
  region: string,
  state: WorldState
): string {
  const block = resolveFamilyStatBlock(family, region, state);
  // Digest the FULL resolved block — id/region/state plus loot, the whole stat
  // block, and sorted element entries (and, for Ashfall, the drained palette +
  // attacks) — so two blocks that differ only in stats or weaknesses cannot
  // collide and undercut the determinism gate.
  const canonical = JSON.stringify({
    id: family.id,
    region,
    state,
    lootGrist: block?.lootGrist ?? null,
    stats: block === null ? null : block.stats,
    elements:
      block === null
        ? null
        : Object.entries(block.elements).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0
          ),
    drainedPalette:
      block !== null && "drainedPalette" in block ? block.drainedPalette : null,
    attacks:
      block !== null && "attacks" in block
        ? block.attacks.map(a => ({
            id: a.id,
            element: a.element,
            power: a.power,
          }))
        : null,
  });
  const digest = Array.from(canonical).reduce(
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), 0x01000193),
    0x811c9dc5
  );
  return (digest >>> 0).toString(16).padStart(8, "0");
}

/**
 * The bridge-held enemy-family cell: load a family authored against the schema,
 * then read its per-region block (a snapshot resolved through a world-state).
 * `null` until a family is loaded, so a stray read on a fresh boot cannot fabricate
 * a family.
 */
export class EnemyCell {
  #family: EnemyFamilyDef | null = null;

  /**
   * Load the canonical example family (`marrow-gangs`) — the "an agent loaded a
   * schema-authored family through the content barrel" verification action. The
   * family is the data shipped in {@link ENEMY_FAMILIES}; loading is pure (no
   * engine edit, no Phaser), proving a family is added by authoring data. Pure.
   * @returns void
   */
  load(): void {
    this.#family = ENEMY_FAMILIES[RegisteredFamilyIds.marrowGangs];
  }

  /**
   * Load an arbitrary authored family into the cell — the seam the e2e uses to
   * feed a family (e.g. one with an invalid variant) and observe validation. Pure:
   * stores the value.
   * @param family - The family to hold.
   * @returns void
   */
  adopt(family: EnemyFamilyDef): void {
    this.#family = family;
  }

  /**
   * A snapshot of the loaded family's Marrow-region block resolved through
   * `state`, or null before a family has been loaded. Lets the family e2e assert
   * the family loads, validates, resolves its Reach block before the Reckoning and
   * its warped Ashfall variant (drained palette + Gloom attack) after.
   * @param state - The world-state to resolve the block through.
   * @returns The family snapshot, or null.
   */
  snapshot(state: WorldState): VerifyEnemyState | null {
    const family = this.#family;
    if (family === null) {
      return null;
    }
    const block = resolveFamilyStatBlock(family, MARROW_REGION, state);
    return {
      id: family.id,
      knownTag: isEnemyFamily(family.id),
      worldState: state,
      region: MARROW_REGION,
      isAshfall: isAshfallBlock(block),
      lootGrist: block?.lootGrist ?? 0,
      drainedPalette: paletteOf(block),
      gloomAttacks: gloomAttacksOf(block),
      complete: isCompleteEnemyFamily(family),
      errors: validateEnemyFamily(family),
      hash: hashFamily(family, MARROW_REGION, state),
    };
  }
}

/**
 * Whether a resolved block is the warped Ashfall variant (it carries the
 * drained-palette marker the Reach block lacks). Pure narrowing helper.
 * @param block - The resolved block (Reach block, Ashfall variant, or null).
 * @returns True when the block is an Ashfall variant.
 */
function isAshfallBlock(block: ResolvedBlock): block is AshfallVariant {
  return block !== null && "drainedPalette" in block;
}

/**
 * The drained-palette marker of a resolved block (only the Ashfall variant has
 * one), or null. Pure.
 * @param block - The resolved block.
 * @returns The palette marker, or null for a Reach block / no block.
 */
function paletteOf(block: ResolvedBlock): string | null {
  return isAshfallBlock(block) ? block.drainedPalette : null;
}

/**
 * The ids of the Gloom/entropy attacks on a resolved block (only the Ashfall
 * variant gains them); empty for a Reach block. Pure.
 * @param block - The resolved block.
 * @returns The Gloom-attack ids ([] for a Reach block / no block).
 */
function gloomAttacksOf(block: ResolvedBlock): readonly string[] {
  if (!isAshfallBlock(block)) {
    return [];
  }
  return block.attacks.filter(a => a.element === "gloom").map(a => a.id);
}
