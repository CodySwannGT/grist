/**
 * Battler art resolution — the single mapping from a combatant's content ref
 * (`Combatant.ref` / {@link PartyMemberId} / {@link EnemyId}) to its frames in
 * the `battlers` atlas. The ingest pipeline names every frame `<ref>/<anim>`
 * (see `scripts/ingest-assets.mjs`), so this module is naming convention, not a
 * lookup of hand-copied strings; the asset-coverage contract test
 * (`tests/logic/asset-coverage.test.ts`) asserts every name built here resolves
 * in the committed atlas, keeping "a missing frame is a failing test" true even
 * though the names are derived.
 *
 * Two art kinds exist: `char` actors ship idle / attack / dead poses plus walk
 * cycles; `monster` actors ship only the 4×4 walk sheet, so their idle *is* a
 * slow walk-cycle bob and their attack pose is a walk frame. The exhaustive
 * {@link BATTLER_KIND} table is compile-checked against the content id unions —
 * registering a new party member or enemy without casting its art is a type
 * error, not a silent white box.
 * @module ui/battler-view
 */
import type { EnemyId, PartyMemberId } from "../content";

/** Every combatant ref that owns battler art. */
export type BattlerRef = PartyMemberId | EnemyId;

/** The two art kinds the ingest pipeline produces (see module doc). */
export const BattlerKinds = {
  char: "char",
  monster: "monster",
} as const;

/** A battler art kind. */
type BattlerKind = (typeof BattlerKinds)[keyof typeof BattlerKinds];

/** The facing directions the sheets provide. */
export const BattlerDirs = {
  down: "down",
  up: "up",
  left: "left",
  right: "right",
} as const;

/** A battler facing direction. */
export type BattlerDir = (typeof BattlerDirs)[keyof typeof BattlerDirs];

/** Walk-cycle frames per direction in every battler's sheet. */
export const WALK_FRAME_COUNT = 4;

/**
 * The exhaustive ref → art-kind cast table. Compile-checked: adding a new
 * content id without an entry here fails the build.
 */
export const BATTLER_KIND: Readonly<Record<BattlerRef, BattlerKind>> = {
  wren: BattlerKinds.char,
  tobi: BattlerKinds.char,
  halcyon: BattlerKinds.char,
  // The Act II reunion roster (#140) — `char` actors like the rest of the party. Their
  // dedicated battler art is authored with their reunion content (a living doc, decision
  // 0003); until that art lands they are ART-PENDING (see `ART_PENDING_REFS` /
  // `battlerArtRef`'s fallback), so the cast is registered here (satisfying the
  // compile-checked exhaustiveness) without a committed atlas frame yet.
  quietus: BattlerKinds.char,
  asch: BattlerKinds.char,
  cal: BattlerKinds.char,
  shrike: BattlerKinds.char,
  "marrow-scrapper": BattlerKinds.monster,
  "render-construct": BattlerKinds.monster,
  "the-ashling": BattlerKinds.monster,
  "house-enforcer": BattlerKinds.char,
  "drowned-husk": BattlerKinds.monster,
  "requiem-wraith": BattlerKinds.monster,
  "deep-auditor": BattlerKinds.monster,
  "halcyon-knight": BattlerKinds.char,
} as const;

/**
 * Cast refs whose dedicated battler art has not yet been authored — the Act II reunion
 * roster (#140), whose art ships with their reunion content (a living doc, decision
 * 0003). They are registered in {@link BATTLER_KIND} so the exhaustive, compile-checked
 * cast type stays satisfied, but are held out of the art-iteration seams below until
 * their frames land: {@link BATTLER_REFS} (anim registration + the asset-coverage
 * contract) excludes them, and {@link battlerArtRef} falls them back to stand-in art —
 * so an art-pending member never registers a missing-frame anim or renders a white box.
 * Remove a ref here the moment its `<ref>/…` frames are committed to the atlas.
 */
const ART_PENDING_REFS: ReadonlySet<BattlerRef> = new Set<BattlerRef>([
  "quietus",
  "asch",
  "cal",
  "shrike",
]);

/**
 * Every cast battler ref that owns committed art (iteration order = table order) — the
 * {@link BATTLER_KIND} keys minus the {@link ART_PENDING_REFS}. Anim registration and
 * the asset-coverage contract iterate this, so they cover exactly the refs with real
 * atlas frames and never demand frames for an art-pending member.
 */
export const BATTLER_REFS = (
  Object.keys(BATTLER_KIND) as readonly BattlerRef[]
).filter(ref => !ART_PENDING_REFS.has(ref));

/** The stand-in art for a ref that has no casting yet (never a crash). */
const FALLBACK_REF: BattlerRef = "marrow-scrapper";

/**
 * Narrow an arbitrary combatant ref to a cast battler ref with committed art, falling
 * back to {@link FALLBACK_REF} for content that predates its art — an unknown ref, or a
 * cast-but-{@link ART_PENDING_REFS art-pending} member — so the resolved ref always
 * resolves to real atlas frames.
 * @param ref - The combatant's content ref.
 * @returns A ref that is guaranteed to have atlas frames.
 */
export function battlerArtRef(ref: string): BattlerRef {
  return ref in BATTLER_KIND && !ART_PENDING_REFS.has(ref as BattlerRef)
    ? (ref as BattlerRef)
    : FALLBACK_REF;
}

/**
 * The battler's standing pose frame for a facing.
 * @param ref - A cast battler ref.
 * @param dir - The facing direction.
 * @returns The atlas frame name.
 */
export function battlerIdleFrame(ref: BattlerRef, dir: BattlerDir): string {
  return BATTLER_KIND[ref] === BattlerKinds.char
    ? `${ref}/idle-${dir}`
    : `${ref}/walk-${dir}-0`;
}

/**
 * The battler's attack pose frame for a facing (a mid-stride walk frame for
 * monsters, which have no dedicated attack art).
 * @param ref - A cast battler ref.
 * @param dir - The facing direction.
 * @returns The atlas frame name.
 */
export function battlerAttackFrame(ref: BattlerRef, dir: BattlerDir): string {
  return BATTLER_KIND[ref] === BattlerKinds.char
    ? `${ref}/attack-${dir}`
    : `${ref}/walk-${dir}-2`;
}

/**
 * The battler's downed frame: chars have real dead art; monsters keep their
 * standing frame (the scene dims/tints them instead).
 * @param ref - A cast battler ref.
 * @param dir - The facing the battler held when it fell.
 * @returns The atlas frame name.
 */
export function battlerDeadFrame(ref: BattlerRef, dir: BattlerDir): string {
  return BATTLER_KIND[ref] === BattlerKinds.char
    ? `${ref}/dead`
    : battlerIdleFrame(ref, dir);
}

/**
 * One walk-cycle frame name.
 * @param ref - A cast battler ref.
 * @param dir - The facing direction.
 * @param frame - The cycle index (0..{@link WALK_FRAME_COUNT}-1).
 * @returns The atlas frame name.
 */
export function battlerWalkFrame(
  ref: BattlerRef,
  dir: BattlerDir,
  frame: number
): string {
  return `${ref}/walk-${dir}-${frame}`;
}

/**
 * The registered walk/hover animation key for a battler + facing (created once
 * for every cast ref by `registerGameAnims`).
 * @param ref - A cast battler ref.
 * @param dir - The facing direction.
 * @returns The animation key.
 */
export function battlerWalkAnim(ref: BattlerRef, dir: BattlerDir): string {
  return `anim-${ref}-walk-${dir}`;
}

/**
 * The facing implied by a movement vector: the dominant axis wins (ties go
 * horizontal, matching how side-scrolling reads).
 * @param dx - Signed horizontal component.
 * @param dy - Signed vertical component.
 * @returns The facing to show while moving along the vector.
 */
export function facingForMove(dx: number, dy: number): BattlerDir {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx < 0 ? BattlerDirs.left : BattlerDirs.right;
  }
  return dy < 0 ? BattlerDirs.up : BattlerDirs.down;
}
