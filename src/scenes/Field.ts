/**
 * Field scene — the thin top-down adapter between the pure field-traversal sim
 * (`src/logic/field`) and Phaser. It owns NO field rules: the sim
 * ({@link startField} / {@link stepField}) holds room state, encounter triggers,
 * and prop-examine state; this scene RENDERS that state and EMITS field actions.
 * The one piece of state the sim deliberately does not model — Wren's continuous
 * position *within* a room — is adapter-level render state here, advanced every
 * frame by the frame delta times a held/destination direction. Movement and
 * examine arrive as semantic {@link FieldIntent}s on the EventsCenter bus
 * (published by {@link FieldInputService}); no raw `event.key` or pointer
 * coordinate is read in this scene. Every subscription is freed on shutdown.
 * @module scenes/Field
 */
import Phaser from "phaser";
import { AtlasKeys } from "../assets";
import {
  FieldColors,
  FieldEvents,
  FieldLayout,
  SceneKeys,
  type FieldResumeData,
} from "../consts";
import { MARROW_MAP, PartyMemberIds } from "../content";
import {
  BattlerDirs,
  battlerIdleFrame,
  battlerWalkAnim,
  facingForMove,
  type BattlerDir,
} from "../ui/battler-view";
import {
  FieldActionKinds,
  examinablePropForRoom,
  loreForProp,
  stepField,
  toggleMiniMap,
  type FieldState,
} from "../logic/field";
import { newRunState, type RunState } from "../logic/run-state";
import { eventsCenter } from "../services/events";
import { FieldInputService } from "../services/field-input";
import {
  type FieldIntent,
  type FieldMoveDir,
} from "../services/field-input-map";
import { getRunState } from "../services/run-store";
import { drawFieldBackdrop, drawFieldChrome } from "./field-chrome";
import { FieldHud } from "./field-hud";
import { makeFieldView } from "./field-bridge-view";
import { clampUnit, clampWrenToFloor, stepWren } from "./field-motion";
import {
  advanceToNextRoom,
  beginFieldSession,
  engageEncounter,
  launchPendingBattle,
  openPauseMenu,
  resumeFieldFromMenu,
  resumeFieldSession,
} from "./field-launch";
import { fadeSceneIn } from "./scene-transition";
import { verifyBridge, type FieldView } from "../uat/bridge";

/** Fallback seed when none is supplied via the verification bridge / `?seed=`. */
const DEFAULT_SEED = 0x9e3779b1;

/** Renders a {@link FieldState} and emits field actions; holds no field rules. */
export class Field extends Phaser.Scene {
  #state!: FieldState;
  #input!: FieldInputService;
  /** The cross-scene run progression (grist, shards, pending choice). */
  #run: RunState = newRunState();
  /** Wren's live logical (384×216) center — adapter render state, not sim state. */
  #wrenX: number = FieldLayout.wrenSpawnX;
  #wrenY: number = FieldLayout.wrenSpawnY;
  /** A pending tap-to-move destination, or null when walking from held keys. */
  #moveTo: { x: number; y: number } | null = null;
  /**
   * Set when an examine was requested while Wren was still out of range (e.g. a
   * single tap on the sign that first walks her there). Retried the moment she
   * arrives at the tap destination, so a distant sign-tap still surfaces lore.
   */
  #pendingExamine = false;
  #wren!: Phaser.GameObjects.Sprite;
  /** Wren's current facing (drives which walk cycle / idle frame shows). */
  #facing: BattlerDir = BattlerDirs.down;
  /** The examinable-prop marker for the current room, or null when it has none. */
  #sign: Phaser.GameObjects.Rectangle | null = null;
  #loreBox!: Phaser.GameObjects.NineSlice;
  #loreText!: Phaser.GameObjects.Text;
  /** The field HUD (persistent grist readout, context prompt, mini-map). */
  #hud!: FieldHud;
  /** Whether the summonable mini-map overlay is currently open (#107). */
  #miniMapOpen = false;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Field);
  }

  /**
   * Build (or restore) the field session, input, render scaffolding, and bridge.
   * A fresh boot starts the session and enters Room A (its first encounter
   * trigger); a post-battle resume ({@link FieldResumeData}) restores the exact
   * pre-launch session and consumes the just-resolved result (folded into the run,
   * trigger acknowledged) before play continues. Either way, any pending trigger
   * is handed straight to the Battle scene via {@link launchPendingBattle}.
   * @param data - The resume payload, or undefined on a fresh boot.
   * @returns void
   */
  create(data?: Partial<FieldResumeData>): void {
    const run = getRunState(this.registry);
    const seed = verifyBridge.takeSeed() ?? DEFAULT_SEED;
    this.#moveTo = null;
    this.#miniMapOpen = false;
    this.#input = new FieldInputService(this);

    const session = data?.fromMenu
      ? resumeFieldFromMenu(this.registry, run, seed)
      : data?.resumed
        ? resumeFieldSession(this.registry, run, seed)
        : beginFieldSession(run, seed);
    this.#state = session.state;
    this.#run = session.run;
    // A pause-menu return (#233) carries Wren's exact stashed position — she was
    // paused, not sent to battle — so closing the menu drops her back precisely
    // where she stood; every other entry spawns her at the room entrance.
    this.#wrenX = session.wren?.x ?? FieldLayout.wrenSpawnX;
    this.#wrenY = session.wren?.y ?? FieldLayout.wrenSpawnY;
    this.#facing =
      (session.wren?.facing as BattlerDir | undefined) ?? this.#facing;

    // A post-battle resume enters behind the incoming half of the readable return
    // cut (#114 AC2): fade the Field in from black so it reveals rather than snaps. A
    // fresh boot shows instantly — its framing (and the existing field e2e) is
    // unchanged.
    if (data?.resumed) {
      fadeSceneIn(this);
    }

    drawFieldBackdrop(this);
    this.#buildProps();
    this.#buildHud();
    this.#hud = new FieldHud(this, this.#toggleMiniMap, () =>
      this.#input.tapOpenMenu()
    );
    this.#wirePointer();

    eventsCenter.on(FieldEvents.Input, this.#onIntent);
    this.#syncWren();
    this.#syncHud();

    verifyBridge.attach(SceneKeys.Field, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());

    // A fresh boot lands in Room A in `exploring` (the player moves/examines, then
    // engages the encounter); a resume lands back in `exploring` after the cleared
    // room. Neither has a fight pending, so this is a no-op safety net — the only
    // case it fires is a session restored mid-trigger, which it hands to Battle.
    launchPendingBattle(this, this.registry, this.#state);
  }

  /**
   * Per-frame: advance Wren toward her held/destination direction by the frame
   * delta, clamp her to the walkable bounds, and mirror her onto her sprite. The
   * sim is untouched here — movement is pure adapter render state. No allocations.
   * @param _time - Absolute time (unused; movement is delta-driven).
   * @param delta - Milliseconds since the last frame.
   * @returns void
   */
  override update(_time: number, delta: number): void {
    const dir = this.#activeDirection();
    const len = Math.hypot(dir.dx, dir.dy);
    if (len > 0) {
      // Step (normalized so every heading walks at the same speed — a raw held
      // diagonal would move ~41% faster) then clamp to the walkable floor band.
      const next = clampWrenToFloor(
        stepWren(this.#wrenX, this.#wrenY, dir, len, delta)
      );
      this.#wrenX = next.x;
      this.#wrenY = next.y;
      this.#syncWren();
    }
    this.#syncWrenAnim(dir, len > 0);
    // The HUD reflects live state every frame; its grist readout and context
    // prompt repaint only on change (guarded text), so a still frame is free.
    this.#syncHud();
  }

  /**
   * The net movement direction for this frame. A held movement key always wins
   * and cancels any pending tap destination — pressing a direction is the most
   * recent, most explicit player intent. Otherwise Wren walks toward a tap-to-move
   * destination until she arrives (within ~1px, which clears it). `{0,0}` idle.
   * @returns The direction to step this frame ({0,0} when idle).
   */
  #activeDirection(): FieldMoveDir {
    const held = this.#input.heldDirection();
    if (held.dx !== 0 || held.dy !== 0) {
      this.#moveTo = null;
      return held;
    }
    if (this.#moveTo) {
      const dx = this.#moveTo.x - this.#wrenX;
      const dy = this.#moveTo.y - this.#wrenY;
      const len = Math.hypot(dx, dy);
      if (len <= 1) {
        // Arrived: clear the destination and retry a deferred examine (a single
        // tap on a distant prop walks Wren there, then examines on arrival).
        this.#moveTo = null;
        if (this.#pendingExamine) {
          this.#pendingExamine = false;
          this.#examineNearest();
        }
        return { dx: 0, dy: 0 };
      }
      // A fractional direction toward the target; the caller normalizes + scales.
      return {
        dx: clampUnit(dx / len),
        dy: clampUnit(dy / len),
      } as FieldMoveDir;
    }
    return { dx: 0, dy: 0 };
  }

  /**
   * Field-intent handler: a held `move` is polled in {@link update}, so here we
   * only act on `move-to` (tap destination) and `examine`. An immediate examine
   * that fails the range gate is deferred (`#pendingExamine`) and retried when
   * Wren reaches her tap destination, so tapping a prop from a distance still
   * surfaces lore. A stable arrow field so it can be unsubscribed on shutdown.
   * @param intent - The semantic field intent from the bus.
   * @param _device - The originating device (kept for telemetry symmetry).
   * @returns void
   */
  readonly #onIntent = (intent: FieldIntent, _device: string): void => {
    if (intent.kind === "move-to") {
      this.#moveTo = { x: intent.x, y: intent.y };
      return;
    }
    if (intent.kind === "examine") {
      // If out of range now, defer until Wren arrives at the pending destination.
      this.#pendingExamine = !this.#examineNearest();
      return;
    }
    if (intent.kind === "toggle-map") {
      this.#toggleMiniMap();
    }
    if (intent.kind === "open-menu") {
      // Esc hands off to the pause Menu (#233), stashing the live session + Wren's
      // exact position so closing it resumes the Field byte-for-byte. The Menu is a
      // full-screen surface reached by a real scene.start (mirroring Field↔Battle),
      // so the bridge's scene()/view swaps cleanly for the e2e.
      openPauseMenu(this, this.registry, this.#state, {
        x: this.#wrenX,
        y: this.#wrenY,
        facing: this.#facing,
      });
    }
  };

  /**
   * Examine the examinable prop in the current room when Wren is within its
   * examine radius: thread an `examine` action through the pure sim, then surface
   * the resulting lore beat. The examinable prop is derived from the *current
   * room's* content (not hard-coded to Room A); the sim owns whether the prop is
   * examinable and the authored text. Returns whether the examine landed, so the
   * caller can defer a still-out-of-range request until Wren arrives.
   * @returns True when the examine fired (in range, examinable prop present).
   */
  #examineNearest(): boolean {
    const propId = this.#examinablePropId();
    if (!propId || !this.#withinExamineRange()) {
      return false;
    }
    this.#state = stepField(this.#state, {
      kind: FieldActionKinds.examine,
      propId,
    });
    // Author the banner text; its visibility (shown in range, dismissed on
    // walk-away, kept clear of the context prompt) is owned by #syncHud (#234).
    this.#loreText.setText(loreForProp(this.#state, propId) ?? "");
    return true;
  }

  /**
   * The examinable prop placed at the marker in the current room — the prop the
   * scene renders as the examinable marker and `examineNearest` inspects.
   * Resolved purely from the *current room's* content via
   * {@link examinablePropForRoom}: the runner-warrens surface the rendering
   * notice, the rendering-house pass the rendering vat ("what the city eats"),
   * the descent none (the sim ignores examine for props without an authored
   * beat). The scene is never pinned to a single room or prop id.
   * @returns The examinable prop id for the current room, or null when none.
   */
  #examinablePropId(): string | null {
    return examinablePropForRoom(this.#state.currentRoom);
  }

  /**
   * Whether Wren is currently within the examine radius of the current room's
   * examinable prop. Drives the context prompt's visibility (the "context" in
   * context prompt) — the same range gate {@link #examineNearest} uses to decide
   * whether an examine lands, so the prompt and the affordance agree.
   * @returns True when Wren is in range of an examinable prop.
   */
  #withinExamineRange(): boolean {
    if (this.#examinablePropId() === null) {
      return false;
    }
    return (
      Math.hypot(
        this.#wrenX - FieldLayout.signX,
        this.#wrenY - FieldLayout.signY
      ) <= FieldLayout.examineRadius
    );
  }

  /**
   * Refresh the field HUD from live state: the persistent grist readout, the
   * context prompt for the in-range interactable, and (when open) the mini-map.
   * The pure HUD model decides what each surface shows; the scene only supplies
   * the live inputs. Called once on create and every frame from {@link update}.
   * The lore banner is a "stand-at-the-prop" read: it shows only while Wren is in
   * examine range and the prop has been examined (so it dismisses on walk-away),
   * and while it is up the context prompt is suppressed — the two share the bottom
   * band and overlapped, garbling both (#234). The banner text is authored on
   * examine by {@link #examineNearest}; visibility (and the prompt gate) live here.
   * @returns void
   */
  #syncHud(): void {
    const inRange = this.#withinExamineRange();
    const loreVisible = inRange && this.#loreText.text !== "";
    this.#loreBox.setVisible(loreVisible);
    this.#loreText.setVisible(loreVisible);
    this.#hud.sync(
      this.#state,
      this.#run.wallet.grist,
      this.#state.currentRoom,
      this.#examinablePropId(),
      inRange,
      loreVisible
    );
  }

  /**
   * Summon or dismiss the mini-map overlay through the pure {@link toggleMiniMap}
   * transition, then mirror the resulting flag onto the HUD. A stable arrow field
   * so it can be passed as the HUD's touch-summon callback and called from the
   * `toggle-map` intent without rebinding `this`.
   * @returns void
   */
  readonly #toggleMiniMap = (): void => {
    this.#miniMapOpen = toggleMiniMap(this.#miniMapOpen);
    this.#hud.setMiniMapOpen(this.#miniMapOpen);
  };

  /**
   * Place the room props: Wren's placeholder body, and — when the current room
   * has an examinable lore prop — its tappable, glyphed marker. Rooms with no
   * authored lore prop (the descent) render no marker at all, so the scene never
   * shows an examine affordance with nothing behind it. Wren is always placed.
   * @returns void
   */
  #buildProps(): void {
    // Reset the marker reference first: the Field scene instance is reused across
    // room re-creates (Field→Battle→Field), so a stale reference to the previous
    // room's now-destroyed marker must be cleared before a prop-less room (the
    // descent) skips rebuilding it — otherwise #wirePointer would touch a
    // destroyed object.
    this.#sign = null;
    if (this.#examinablePropId() !== null) {
      this.#sign = this.add.rectangle(
        FieldLayout.signX,
        FieldLayout.signY,
        FieldLayout.signWidth,
        FieldLayout.signHeight,
        FieldColors.sign
      );
      this.add
        .text(FieldLayout.signX, FieldLayout.signY, "!", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#141821",
        })
        .setOrigin(0.5);
    }
    this.#wren = this.add.sprite(
      this.#wrenX,
      this.#wrenY,
      AtlasKeys.battlers,
      battlerIdleFrame(PartyMemberIds.wren, this.#facing)
    );
  }

  /**
   * Mirror this frame's movement onto Wren's animation: walking runs the facing
   * walk cycle, stopping holds the idle pose (no-ops on steady frames).
   * @param dir - The frame's movement direction (pre-normalization).
   * @param moving - Whether Wren actually stepped this frame.
   * @returns void
   */
  #syncWrenAnim(dir: FieldMoveDir, moving: boolean): void {
    if (!moving) {
      if (this.#wren.anims.isPlaying) {
        this.#wren
          .stop()
          .setFrame(battlerIdleFrame(PartyMemberIds.wren, this.#facing));
      }
      return;
    }
    this.#facing = facingForMove(dir.dx, dir.dy);
    this.#wren.play(battlerWalkAnim(PartyMemberIds.wren, this.#facing), true);
  }

  /**
   * Build the static chrome (room name + examine affordance) and the hidden lore
   * banner via the extracted {@link drawFieldChrome} helper, keeping the lore
   * box/text refs the examine surfaces. Pulled out so the scene stays thin.
   * @returns void
   */
  #buildHud(): void {
    const chrome = drawFieldChrome(this, MARROW_MAP[this.#state.currentRoom]);
    this.#loreBox = chrome.loreBox;
    this.#loreText = chrome.loreText;
  }

  /**
   * Wire the pointer: tapping the floor sets a tap-to-move destination (mapped
   * from the pointer's logical coords) and — when the current room has an
   * examinable prop marker — tapping that marker examines it. Both routed through
   * the semantic {@link FieldInputService}, so no raw pointer math leaks past it.
   * @returns void
   */
  #wirePointer(): void {
    this.#sign
      ?.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
        // Tapping the marker first walks to it, then examines — the tap is a
        // semantic move-to + examine, never a raw coordinate read in gameplay.
        this.#input.tapMoveTo(FieldLayout.signX, FieldLayout.signY);
        this.#input.tapExamine();
        pointer.event?.stopPropagation();
      });
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer) => {
        // pointer.worldX/Y are already in the scene's logical (384×216) space.
        this.#input.tapMoveTo(pointer.worldX, pointer.worldY);
      }
    );
  }

  /**
   * Mirror Wren's logical position onto her sprite. Allocation-free.
   * @returns void
   */
  #syncWren(): void {
    this.#wren.setPosition(this.#wrenX, this.#wrenY);
  }

  /**
   * The live link handed to the verification bridge — render scale, room / phase,
   * Wren's position, surfaced lore, run-state (grist / shards / pending choice),
   * the field-HUD context prompt + mini-map state, and the deterministic
   * examine / engage / traverse / toggle-map actions. Assembled by the extracted
   * {@link makeFieldView} factory from this scene's accessor seam, so the scene
   * body stays a thin renderer under its line budget.
   * @returns The field view.
   */
  #bridgeView(): FieldView {
    return makeFieldView({
      scene: this,
      state: () => this.#state,
      wren: () => ({ x: this.#wrenX, y: this.#wrenY }),
      examinableProp: () => this.#examinablePropId(),
      inExamineRange: () => this.#withinExamineRange(),
      grist: () => this.#run.wallet.grist,
      shards: () => this.#run.shards,
      pendingChoiceShard: () => this.#run.pendingChoiceShard,
      miniMapOpen: () => this.#miniMapOpen,
      toggleMiniMap: () => this.#toggleMiniMap(),
      examineNearest: () => this.#bridgeExamine(),
      engage: () => {
        // Fire the current room's encounter, launching its battle (the
        // deterministic "agent engaged the encounter in this room" path).
        this.#state = engageEncounter(this, this.registry, this.#state);
      },
      traverse: () => {
        // Advance to the next room, firing its trigger — which launches the next
        // battle (the deterministic "agent walked to the next encounter" path).
        this.#state = advanceToNextRoom(this, this.registry, this.#state);
      },
    });
  }

  /**
   * The bridge's deterministic examine: teleport Wren onto the sign so the range
   * gate passes, clear any pending move/examine, then examine the nearest prop.
   * @returns void
   */
  #bridgeExamine(): void {
    this.#wrenX = FieldLayout.signX;
    this.#wrenY = FieldLayout.signY;
    this.#moveTo = null;
    this.#pendingExamine = false;
    this.#syncWren();
    this.#examineNearest();
  }

  /**
   * Free every external subscription on scene shutdown (the
   * `require-shutdown-cleanup` contract): detach the bridge, unsubscribe the
   * field-intent bus listener, and dispose the InputService keyboard listeners.
   * @returns void
   */
  #shutdown(): void {
    verifyBridge.attach("", null);
    eventsCenter.off(FieldEvents.Input, this.#onIntent);
    this.#input.dispose();
  }
}
