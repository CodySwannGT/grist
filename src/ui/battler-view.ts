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
 * Two art kinds exist. Since the bespoke PixelLab cast (#203) every ref ships a
 * real idle pose, a real attack pose, and a full walk cycle per facing — so the
 * kind now only decides the DOWNED pose: `char` (the party) ships a dedicated
 * `dead` frame (its most-collapsed hurt pose); `monster` (enemies) ships no hurt
 * kit, so its downed pose is its idle frame, dimmed by the scene. Monsters also
 * keep playing their walk cycle as a slow idle bob (a hovering read), which the
 * spirit refs layer a gentle float on top of ({@link SPIRIT_HOVER_REFS}). The
 * exhaustive {@link BATTLER_KIND} table is compile-checked against the content id
 * unions — registering a new party member or enemy without casting its art is a
 * type error, not a silent white box.
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

/**
 * Walk-cycle frame count per direction, per ref. The PixelLab cast (#203) renders
 * 6-frame walk cycles (a few mannequin templates yield 4); this table is the
 * single source of truth for anim registration and the asset-coverage contract,
 * so a ref whose committed cycle length changes is a one-line edit here (and the
 * contract test proves the count matches the committed atlas frames). Defaulted
 * via {@link battlerWalkFrameCount} so an un-listed ref falls back to the common
 * 6-frame cycle.
 */
const WALK_FRAMES: Readonly<Record<BattlerRef, number>> = {
  wren: 6,
  tobi: 6,
  halcyon: 6,
  quietus: 6,
  asch: 6,
  cal: 6,
  shrike: 6,
  "marrow-scrapper": 6,
  "render-construct": 6,
  "the-ashling": 6,
  "house-enforcer": 6,
  "drowned-husk": 6,
  "requiem-wraith": 6,
  "deep-auditor": 6,
  "halcyon-knight": 6,
} as const;

/** The common walk-cycle length when a ref is not listed in {@link WALK_FRAMES}. */
const DEFAULT_WALK_FRAMES = 6;

/**
 * The walk-cycle frame count for a ref (its {@link WALK_FRAMES} entry, or the
 * common {@link DEFAULT_WALK_FRAMES}).
 * @param ref - A cast battler ref.
 * @returns The number of walk frames per direction.
 */
export function battlerWalkFrameCount(ref: BattlerRef): number {
  return WALK_FRAMES[ref] ?? DEFAULT_WALK_FRAMES;
}

/**
 * The exhaustive ref → art-kind cast table. Compile-checked: adding a new
 * content id without an entry here fails the build. `char` = the party (ships a
 * dedicated `dead` pose); `monster` = enemies (downed pose is the dimmed idle).
 */
export const BATTLER_KIND: Readonly<Record<BattlerRef, BattlerKind>> = {
  wren: BattlerKinds.char,
  tobi: BattlerKinds.char,
  halcyon: BattlerKinds.char,
  // The Act II reunion roster (#140) — now fully cast as bespoke PixelLab `char`
  // actors (#203), each with real idle/attack/walk plus a `dead` pose carved from
  // its hurt kit. No longer ART-PENDING.
  quietus: BattlerKinds.char,
  asch: BattlerKinds.char,
  cal: BattlerKinds.char,
  shrike: BattlerKinds.char,
  "marrow-scrapper": BattlerKinds.monster,
  "render-construct": BattlerKinds.monster,
  "the-ashling": BattlerKinds.monster,
  // Enemies: no hurt kit, so `monster` (downed = dimmed idle). The gladiator and
  // frame-knight bosses were `char` under the Ninja Adventure stand-ins (which had
  // Dead.png); their PixelLab kits ship no hurt frames, so they are `monster` now.
  "house-enforcer": BattlerKinds.monster,
  "drowned-husk": BattlerKinds.monster,
  "requiem-wraith": BattlerKinds.monster,
  "deep-auditor": BattlerKinds.monster,
  "halcyon-knight": BattlerKinds.monster,
} as const;

/**
 * Cast refs whose dedicated battler art has not yet been authored. Empty since the
 * full bespoke cast landed (#203): every ref in {@link BATTLER_KIND} owns committed
 * atlas frames. Kept as the seam (with {@link battlerArtRef}'s fallback) so a
 * future ref registered ahead of its art never renders a white box — add it here
 * and it is held out of {@link BATTLER_REFS} until its `<ref>/…` frames land.
 */
const ART_PENDING_REFS: ReadonlySet<BattlerRef> = new Set<BattlerRef>([]);

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
 * The battler's standing pose frame for a facing. Every ref ships a real idle
 * pose since the bespoke cast (#203).
 * @param ref - A cast battler ref.
 * @param dir - The facing direction.
 * @returns The atlas frame name.
 */
export function battlerIdleFrame(ref: BattlerRef, dir: BattlerDir): string {
  return `${ref}/idle-${dir}`;
}

/**
 * The battler's attack pose frame for a facing (the mid-swing pose). Every ref
 * ships a real attack pose since the bespoke cast (#203).
 * @param ref - A cast battler ref.
 * @param dir - The facing direction.
 * @returns The atlas frame name.
 */
export function battlerAttackFrame(ref: BattlerRef, dir: BattlerDir): string {
  return `${ref}/attack-${dir}`;
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
 * @param frame - The cycle index (0..{@link battlerWalkFrameCount}(ref)-1).
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

/**
 * The spirit/wraith refs that should FLOAT in battle (#203): a gentle looping
 * y-bob layered on top of the idle, since the PixelLab mannequin rig has no
 * floating template so these spirits *step* rather than glide. Quietus (the
 * spectral party defector), the requiem-wraith, and the-ashling read as
 * un-tethered — the hover sells it. Reduced-motion-aware at the call site
 * (`ui/juice` `spiritHover`).
 */
const SPIRIT_HOVER_REFS: ReadonlySet<BattlerRef> = new Set<BattlerRef>([
  "quietus",
  "requiem-wraith",
  "the-ashling",
]);

/**
 * Whether a ref floats in battle (a gentle looping hover bob).
 * @param ref - A cast battler ref.
 * @returns True for the spirit refs in {@link SPIRIT_HOVER_REFS}.
 */
export function battlerHovers(ref: BattlerRef): boolean {
  return SPIRIT_HOVER_REFS.has(ref);
}

/**
 * Per-ref battle display scale. The bespoke cast (#203) trims to varied cell
 * sizes (party ~14-20×26-29, up to ~28×38 bosses); the default integer
 * {@link DEFAULT_DISPLAY_SCALE} of 2 keeps the 16-wide refs at their shipped
 * 2× read, while the tallest bosses scale down so they stay proportionate and
 * do not overflow their battle row. Field placement is unaffected (Wren renders
 * at native scale on the field).
 */
const DISPLAY_SCALE: Readonly<Partial<Record<BattlerRef, number>>> = {
  "the-ashling": 1.5,
  "deep-auditor": 1.5,
  "halcyon-knight": 1.5,
};

/** The default battle display scale for a ref not listed in {@link DISPLAY_SCALE}. */
const DEFAULT_DISPLAY_SCALE = 2;

/**
 * The battle display scale for a ref (its {@link DISPLAY_SCALE} override, or the
 * {@link DEFAULT_DISPLAY_SCALE}).
 * @param ref - A cast battler ref.
 * @returns The scale to apply to the battler sprite on the battle stage.
 */
export function battlerDisplayScale(ref: BattlerRef): number {
  return DISPLAY_SCALE[ref] ?? DEFAULT_DISPLAY_SCALE;
}
