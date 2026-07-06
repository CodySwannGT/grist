/**
 * Battler stage views — builds and mirrors the pooled per-combatant render
 * objects (battler sprite + floating HP/ATB bars) for the side-view battle,
 * and plays the one-shot event juice for newly logged sim events. Extracted
 * from the Battle scene so the scene stays a thin per-frame mirror under its
 * line budget; everything here is presentation only and allocates solely on
 * discrete events, never on the steady-state frame.
 * @module ui/battler-stage
 */
import Phaser from "phaser";
import { AtlasKeys } from "../assets";
import { BattleColors, BattleLayout } from "../consts";
import {
  AtbTuning,
  BattleSides,
  type BattleEvent,
  type BattleSide,
  type Combatant,
} from "../logic/combat";
import { AudioCues, hasRendering, justRendered } from "../logic/audio";
import { soundService } from "../services/sound-service";
import { BREAK_FX, fxForEvent, justBroke, type FxSelection } from "./battle-fx";
import {
  BATTLER_KIND,
  BattlerDirs,
  BattlerKinds,
  battlerAttackFrame,
  battlerDeadFrame,
  battlerDisplayScale,
  battlerHovers,
  battlerIdleFrame,
  battlerWalkAnim,
  type BattlerDir,
  type BattlerRef,
} from "./battler-view";
import {
  attackLunge,
  damagePopup,
  hitFlash,
  hitstop,
  JuiceTuning,
  screenShake,
  spiritHover,
} from "./juice";
import { unitCenter } from "./layout";
/** Sprite alpha while the combatant is alive. */
const ALIVE_ALPHA = 1;
/** Sprite alpha once the combatant is downed (doubles as the state marker). */
const DOWNED_ALPHA = 0.4;
/** How long an attacker holds its attack pose before returning to idle (ms). */
const ATTACK_POSE_MS = 260;
/** Damage at or above this triggers the camera shake (heavy-hit weight). */
const SHAKE_DAMAGE_THRESHOLD = 10;
/** Damage popup colors per victim side. */
const POPUP_ENEMY_HIT = "#ffd166";
const POPUP_PARTY_HIT = "#ff8f8f";

/**
 * The sprite DataManager key holding the last-mirrored Broken state — the
 * applied-visual marker that makes the Break beat (burst + hitstop) fire exactly
 * once on the false→true edge, the same "state doubles as the marker" discipline
 * the alive/downed alpha uses. Stored on the sprite (via `setData`, a method) so
 * the mirror stays free of direct object mutation.
 */
const BROKEN_DATA_KEY = "broken";

/**
 * The sprite DataManager key holding the last-mirrored Rendering presence — the
 * false→true edge that fires the Rendering stinger exactly once per application
 * (#115), the audio counterpart of {@link BROKEN_DATA_KEY}. Cleared when the
 * status lapses (or a reseed rebinds an un-Rendered combatant) so a later
 * re-application fires afresh.
 */
const RENDERING_DATA_KEY = "rendering";

/** The pooled render objects mirroring one combatant. */
export interface UnitView {
  readonly unit: Phaser.GameObjects.Sprite;
  readonly hpFill: Phaser.GameObjects.Rectangle;
  readonly atbFill: Phaser.GameObjects.Rectangle;
  readonly artRef: BattlerRef;
  readonly facing: BattlerDir;
  /** The sprite's resting Y — restored when a floating unit is downed. */
  readonly baseY: number;
}

/** Both sides' pooled views, index-aligned to the sim's combatant arrays. */
export interface StageViews {
  readonly party: readonly UnitView[];
  readonly enemies: readonly UnitView[];
}

/**
 * Create the pooled objects for one combatant: its battler sprite (idle pose,
 * facing its foes; monsters play their hover cycle) and a floating HP + ATB
 * bar pair.
 * @param scene - The owning scene.
 * @param side - The combatant's side.
 * @param index - The combatant's index within its side.
 * @param artRef - The combatant's cast battler ref.
 * @returns The pooled view for the combatant.
 */
export function buildUnitView(
  scene: Phaser.Scene,
  side: BattleSide,
  index: number,
  artRef: BattlerRef
): UnitView {
  const { x, y } = unitCenter(side, index);
  const facing =
    side === BattleSides.party ? BattlerDirs.left : BattlerDirs.right;
  const unit = scene.add
    .sprite(x, y, AtlasKeys.battlers, battlerIdleFrame(artRef, facing))
    .setScale(battlerDisplayScale(artRef));
  // Float the bars off the sprite's ACTUAL top (the bespoke cast varies in
  // height, #203) so they clear the head rather than a fixed placeholder box.
  const hpBarY =
    y -
    unit.displayHeight / 2 -
    BattleLayout.barGap -
    BattleLayout.hpBarHeight / 2;
  const atbBarY =
    hpBarY -
    BattleLayout.hpBarHeight / 2 -
    BattleLayout.barGap -
    BattleLayout.atbBarHeight / 2;
  const hpFill = addBarPair(
    scene,
    x,
    hpBarY,
    BattleLayout.hpBarHeight,
    BattleColors.hpBarBg,
    BattleColors.hpBarFill
  );
  const atbFill = addBarPair(
    scene,
    x,
    atbBarY,
    BattleLayout.atbBarHeight,
    BattleColors.atbBarBg,
    BattleColors.atbBarFill
  );
  if (BATTLER_KIND[artRef] === BattlerKinds.monster) {
    // A monster's idle IS its slow walk cycle — reads as a hover/bob.
    unit.play(battlerWalkAnim(artRef, facing));
  }
  if (battlerHovers(artRef)) {
    // A spirit floats: a gentle looping y-bob layered on the idle (#203).
    spiritHover(scene, unit);
  }
  return { unit, hpFill, atbFill, artRef, facing, baseY: y };
}

/**
 * Add one floating bar (background track + left-anchored fill) and return the
 * fill, whose `scaleX` the per-frame sync drives.
 * @param scene - The owning scene.
 * @param x - The bar's center X.
 * @param y - The bar's center Y.
 * @param height - The bar's height (px).
 * @param bgColor - The track color.
 * @param fillColor - The fill color.
 * @returns The fill rectangle.
 */
function addBarPair(
  scene: Phaser.Scene,
  x: number,
  y: number,
  height: number,
  bgColor: number,
  fillColor: number
): Phaser.GameObjects.Rectangle {
  const track = scene.add.rectangle(
    x,
    y,
    BattleLayout.barWidth,
    height,
    bgColor
  );
  // The fill sits one depth above its track so the pair never interleaves
  // with sprites that share the default depth.
  return scene.add
    .rectangle(
      x - BattleLayout.barWidth / 2,
      y,
      BattleLayout.barWidth,
      height,
      fillColor
    )
    .setOrigin(0, 0.5)
    .setDepth(track.depth + 1);
}

/**
 * Mirror one combatant onto its view: HP/ATB bar fill, the downed/alive pose
 * transition, and the Break beat. The sprite's alpha doubles as the alive marker
 * and `view.broken` as the Break marker, so each transition's work runs exactly
 * once — steady-state frames only write two scale scalars (plus a cheap re-assert
 * of the Broken tint if a hit-flash cleared it). Returns the Break FX to play on
 * the frame a living combatant first Breaks (else null), so the scene can record
 * it for the verification bridge.
 * @param scene - The owning scene (Break burst + hitstop factory).
 * @param view - The combatant's pooled view.
 * @param combatant - The live combatant.
 * @returns The Break FX selection on the Break edge, else null.
 */
export function syncUnitView(
  scene: Phaser.Scene,
  view: UnitView,
  combatant: Combatant
): FxSelection | null {
  const alive = combatant.hp > 0;
  if (alive) {
    syncRenderingCue(view, combatant);
  }
  view.hpFill.setScale(
    Phaser.Math.Clamp(combatant.hp / combatant.stats.hp, 0, 1),
    1
  );
  view.atbFill.setScale(
    Phaser.Math.Clamp(combatant.atb / AtbTuning.ready, 0, 1),
    1
  );
  if (!alive && view.unit.alpha === ALIVE_ALPHA) {
    downUnitView(scene, view);
    return null;
  }
  if (alive && view.unit.alpha !== ALIVE_ALPHA) {
    reviveUnitView(scene, view);
  }
  return syncBrokenState(scene, view, combatant, alive);
}

/**
 * The alive→downed transition: stop the idle motion, drop to the dead pose, and
 * dim. A floating unit also has its hover tween killed and settles onto its
 * resting Y (non-floating units keep the original behavior — an in-flight lunge
 * yoyo completes untouched).
 * @param scene - The owning scene (tween manager).
 * @param view - The combatant's pooled view.
 * @returns void
 */
function downUnitView(scene: Phaser.Scene, view: UnitView): void {
  view.unit.stop();
  if (battlerHovers(view.artRef)) {
    scene.tweens.killTweensOf(view.unit);
    view.unit.setY(view.baseY);
  }
  view.unit
    .setFrame(battlerDeadFrame(view.artRef, view.facing))
    .setTint(BattleColors.downedTint)
    .setAlpha(DOWNED_ALPHA);
}

/**
 * The downed→alive transition (a reseed rebinding a living combatant): restore
 * the idle pose, replay a monster's walk-bob, and re-arm a spirit's float (its
 * hover tween was killed when it was downed).
 * @param scene - The owning scene (tween factory).
 * @param view - The combatant's pooled view.
 * @returns void
 */
function reviveUnitView(scene: Phaser.Scene, view: UnitView): void {
  view.unit
    .setFrame(battlerIdleFrame(view.artRef, view.facing))
    .clearTint()
    .setAlpha(ALIVE_ALPHA);
  if (BATTLER_KIND[view.artRef] === BattlerKinds.monster) {
    view.unit.play(battlerWalkAnim(view.artRef, view.facing));
  }
  if (battlerHovers(view.artRef)) {
    view.unit.setY(view.baseY);
    spiritHover(scene, view.unit);
  }
}

/**
 * Mirror the Broken state onto a living combatant's view: on the first Break
 * edge, fire the burst + hitstop and hold the vulnerable tint; on every later
 * frame, re-assert that tint only if a transient hit-flash cleared it (so
 * steady state stays allocation- and write-free). The downed branch already
 * returned, so this only runs for a living combatant.
 * @param scene - The owning scene.
 * @param view - The combatant's pooled view.
 * @param combatant - The live combatant.
 * @param alive - Whether the combatant is alive (always true here).
 * @returns The Break FX on the Break edge, else null.
 */
function syncBrokenState(
  scene: Phaser.Scene,
  view: UnitView,
  combatant: Combatant,
  alive: boolean
): FxSelection | null {
  // The downed branch owns the corpse's tint; leave it untouched here.
  if (!alive) {
    return null;
  }
  const wasBroken = view.unit.getData(BROKEN_DATA_KEY) === true;
  if (!combatant.broken) {
    // Clear a STALE Broken marker (a reseed rebinds a fresh, un-Broken combatant
    // to this pooled sprite; Broken is otherwise monotonic within a battle) so
    // the next Break after a restart fires its burst + hitstop + fx() signal.
    if (wasBroken) {
      view.unit.setData(BROKEN_DATA_KEY, false).clearTint();
    }
    return null;
  }
  if (justBroke(wasBroken, combatant)) {
    view.unit.setData(BROKEN_DATA_KEY, true).setTint(BattleColors.brokenTint);
    spawnFx(scene, BREAK_FX, view.unit);
    soundService.playCue(AudioCues.break);
    hitstop(scene);
    return BREAK_FX;
  }
  if (!view.unit.isTinted) {
    view.unit.setTint(BattleColors.brokenTint);
  }
  return null;
}

/**
 * Fire the Rendering stinger on the frame a living combatant first gains the
 * Rendering DoT (#115). Edge-triggered off the sprite's stored prior presence —
 * the {@link BROKEN_DATA_KEY} discipline — so the cue plays exactly once per
 * application and re-arms after the status lapses or a reseed. Presentation only:
 * the cue records + captions itself; the sim is untouched.
 * @param view - The combatant's pooled view.
 * @param combatant - The live (alive) combatant.
 * @returns void
 */
function syncRenderingCue(view: UnitView, combatant: Combatant): void {
  const wasRendering = view.unit.getData(RENDERING_DATA_KEY) === true;
  const now = hasRendering(combatant.statuses);
  if (now !== wasRendering) {
    view.unit.setData(RENDERING_DATA_KEY, now);
  }
  if (justRendered(wasRendering, combatant.statuses)) {
    soundService.playCue(AudioCues.rendering);
  }
}

/**
 * The juice for one resolved action event: actor beat + target beat. Returns
 * the FX selection shown over the target (or null when the event has no target),
 * so the scene can record the last-played FX for the verification bridge.
 * @param scene - The owning scene.
 * @param views - Both sides' pooled views.
 * @param event - The newly logged battle event.
 * @returns The FX selection played over the target, or null.
 */
export function playEventJuice(
  scene: Phaser.Scene,
  views: StageViews,
  event: BattleEvent
): FxSelection | null {
  const actor = event.actor
    ? viewAt(views, event.actor.side, event.actor.index)
    : null;
  if (actor) {
    playActorJuice(scene, actor, event.actor?.side === BattleSides.party);
  }
  const target = event.target
    ? viewAt(views, event.target.side, event.target.index)
    : null;
  return target ? playTargetJuice(scene, target, event) : null;
}

/**
 * The attacker's beat: a lunge toward the foe, and (for chars, which have
 * dedicated pose art) a held attack pose that reverts to idle.
 * @param scene - The owning scene.
 * @param actor - The attacker's view.
 * @param isParty - Whether the attacker fights on the party side.
 * @returns void
 */
function playActorJuice(
  scene: Phaser.Scene,
  actor: UnitView,
  isParty: boolean
): void {
  attackLunge(scene, actor.unit, (isParty ? -1 : 1) * JuiceTuning.lungePx);
  if (BATTLER_KIND[actor.artRef] === BattlerKinds.char) {
    actor.unit.setFrame(battlerAttackFrame(actor.artRef, actor.facing));
    scene.time.delayedCall(ATTACK_POSE_MS, () => {
      if (actor.unit.alpha === ALIVE_ALPHA) {
        actor.unit.setFrame(battlerIdleFrame(actor.artRef, actor.facing));
      }
    });
  }
}

/**
 * The target's beat: the element-read FX strip for the action, and on real
 * damage a hit-flash, a damage popup, and (heavy hits) a camera shake. Returns
 * the FX selection so the caller can record the last-played FX.
 * @param scene - The owning scene.
 * @param target - The target's view.
 * @param event - The logged event (kind + element + damage + victim side).
 * @returns The FX selection played over the target.
 */
function playTargetJuice(
  scene: Phaser.Scene,
  target: UnitView,
  event: BattleEvent
): FxSelection {
  const damage = event.damage ?? 0;
  const popupY = target.unit.y - (target.unit.displayHeight / 2 + 2);
  const popupColor =
    event.target?.side === BattleSides.party
      ? POPUP_PARTY_HIT
      : POPUP_ENEMY_HIT;
  const selection = fxForEvent(event);
  spawnFx(scene, selection, target.unit);
  if (damage <= 0) {
    return selection;
  }
  hitFlash(scene, target.unit);
  damagePopup(scene, target.unit.x, popupY, String(damage), popupColor);
  if (damage >= SHAKE_DAMAGE_THRESHOLD) {
    screenShake(scene);
  }
  return selection;
}

/**
 * Spawn a play-once FX strip over a unit, tinted to its color-language flavor,
 * and free it when it finishes. Shared by the per-element action FX and the
 * Break burst.
 * @param scene - The owning scene.
 * @param selection - The FX animation key + tint to play.
 * @param over - The sprite the FX plays over.
 * @returns void
 */
function spawnFx(
  scene: Phaser.Scene,
  selection: FxSelection,
  over: Phaser.GameObjects.Sprite
): void {
  const fx = scene.add
    .sprite(over.x, over.y, AtlasKeys.fx)
    .setDepth(over.depth + 1)
    .setTint(selection.tint);
  fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
  fx.play(selection.anim);
}

/**
 * Look up the pooled view for a combatant ref, if it exists.
 * @param views - Both sides' pooled views.
 * @param side - The combatant's side.
 * @param index - The combatant's index within its side.
 * @returns The view, or null when the index is out of range.
 */
function viewAt(
  views: StageViews,
  side: BattleSide,
  index: number
): UnitView | null {
  const list = side === BattleSides.party ? views.party : views.enemies;
  return list[index] ?? null;
}
