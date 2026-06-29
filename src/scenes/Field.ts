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
import {
  FieldColors,
  FieldEvents,
  FieldLayout,
  FieldTextStyles,
  GameView,
  SceneKeys,
  type FieldResumeData,
} from "../consts";
import { MARROW_MAP } from "../content";
import {
  FieldActionKinds,
  loreForProp,
  stepField,
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
import { drawFieldBackdrop } from "./field-chrome";
import {
  advanceToNextRoom,
  beginFieldSession,
  engageEncounter,
  launchPendingBattle,
  resumeFieldSession,
} from "./field-launch";
import { verifyBridge, type FieldView } from "../uat/bridge";

/** Fallback seed when none is supplied via the verification bridge / `?seed=`. */
const DEFAULT_SEED = 0x9e3779b1;
/** The examinable rendering-notice prop placed in Room A. */
const SIGN_PROP_ID = "warren-sign";

const {
  roomName: ROOM_NAME_STYLE,
  prompt: PROMPT_STYLE,
  lore: LORE_STYLE,
} = FieldTextStyles;

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
  #wren!: Phaser.GameObjects.Rectangle;
  #sign!: Phaser.GameObjects.Rectangle;
  #loreBox!: Phaser.GameObjects.Rectangle;
  #loreText!: Phaser.GameObjects.Text;

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
    this.#wrenX = FieldLayout.wrenSpawnX;
    this.#wrenY = FieldLayout.wrenSpawnY;
    this.#moveTo = null;
    this.#input = new FieldInputService(this);

    const session = data?.resumed
      ? resumeFieldSession(this.registry, run, seed)
      : beginFieldSession(run, seed);
    this.#state = session.state;
    this.#run = session.run;

    drawFieldBackdrop(this);
    this.#buildProps();
    this.#buildHud();
    this.#wirePointer();

    eventsCenter.on(FieldEvents.Input, this.#onIntent);
    this.#syncWren();

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
      // Normalize the direction before scaling so every heading — single-axis,
      // a held keyboard diagonal (dx=±1,dy=±1), or a fractional tap-to-move
      // vector — walks at the same `moveSpeed`. Without this a held diagonal
      // would move ~41% faster than a straight walk.
      const stepPx = (FieldLayout.moveSpeed * delta) / 1000;
      this.#wrenX += (dir.dx / len) * stepPx;
      this.#wrenY += (dir.dy / len) * stepPx;
      this.#clampWren();
      this.#syncWren();
    }
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
    if (!propId) {
      return false;
    }
    const within =
      Math.hypot(
        this.#wrenX - FieldLayout.signX,
        this.#wrenY - FieldLayout.signY
      ) <= FieldLayout.examineRadius;
    if (!within) {
      return false;
    }
    this.#state = stepField(this.#state, {
      kind: FieldActionKinds.examine,
      propId,
    });
    this.#renderLore(propId);
    return true;
  }

  /**
   * The examinable prop placed at the sign marker in the current room — the prop
   * the scene renders as the examinable marker and `examineNearest` inspects. The
   * Room-A rendering notice is the slice's lore prop; other rooms may have none
   * (the sim ignores examine for props without an authored beat). Derived from the
   * current room so the scene is not pinned to Room A.
   * @returns The examinable prop id for the current room, or null when none.
   */
  #examinablePropId(): string | null {
    const room = MARROW_MAP[this.#state.currentRoom];
    return room.props.some(prop => prop.id === SIGN_PROP_ID)
      ? SIGN_PROP_ID
      : null;
  }

  /**
   * Place the room props: Wren's placeholder body and the rendering-notice sign
   * (a tappable, labelled marker the player examines).
   * @returns void
   */
  #buildProps(): void {
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
    this.#wren = this.add.rectangle(
      this.#wrenX,
      this.#wrenY,
      FieldLayout.wrenWidth,
      FieldLayout.wrenHeight,
      FieldColors.wren
    );
  }

  /**
   * Build the static chrome (room name + examine prompt) and the initially-hidden
   * lore banner the examine surfaces.
   * @returns void
   */
  #buildHud(): void {
    this.add
      .text(
        GameView.width / 2,
        6,
        MARROW_MAP[this.#state.currentRoom].name,
        ROOM_NAME_STYLE
      )
      .setOrigin(0.5, 0);
    this.add
      .text(
        FieldLayout.signX,
        FieldLayout.signY - FieldLayout.signHeight,
        "[E] examine",
        PROMPT_STYLE
      )
      .setOrigin(0.5, 1);
    this.#loreBox = this.add
      .rectangle(
        FieldLayout.loreBoxX,
        FieldLayout.loreBoxY,
        FieldLayout.loreBoxWidth,
        FieldLayout.loreBoxHeight,
        FieldColors.loreBoxFill
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, FieldColors.loreBoxStroke)
      .setVisible(false);
    this.#loreText = this.add
      .text(FieldLayout.loreBoxX + 4, FieldLayout.loreBoxY + 4, "", LORE_STYLE)
      .setOrigin(0, 0)
      .setVisible(false);
  }

  /**
   * Wire the pointer: tapping the floor sets a tap-to-move destination (mapped
   * from the pointer's logical coords) and tapping the sign examines it — both
   * routed through the semantic {@link FieldInputService}, so no raw pointer math
   * leaks past it.
   * @returns void
   */
  #wirePointer(): void {
    this.#sign
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
        // Tapping the sign first walks to it, then examines — the tap is a
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
   * Clamp Wren's center to the walkable floor band (below the wall line, inside
   * the edge inset on every side) so she can never leave the room.
   * @returns void
   */
  #clampWren(): void {
    const { edgeInset } = FieldLayout;
    this.#wrenX = Phaser.Math.Clamp(
      this.#wrenX,
      edgeInset,
      GameView.width - edgeInset
    );
    this.#wrenY = Phaser.Math.Clamp(
      this.#wrenY,
      FieldLayout.wallY + edgeInset,
      GameView.height - edgeInset
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
   * Surface (or hide) the lore banner from the sim's examine state. Reads the
   * authored text via the pure {@link loreForProp} selector — the scene holds no
   * copy of its own.
   * @param propId - The examined prop whose lore to surface.
   * @returns void
   */
  #renderLore(propId: string): void {
    const lore = loreForProp(this.#state, propId);
    const visible = lore !== null;
    this.#loreBox.setVisible(visible);
    this.#loreText.setVisible(visible).setText(lore ?? "");
  }

  /**
   * The live link handed to the verification bridge: render scale, room / phase,
   * Wren's position, surfaced lore, the run-state (grist / shards / pending
   * choice — so an e2e can assert AC2/AC4 outcomes), and a deterministic examine.
   * @returns The field view.
   */
  #bridgeView(): FieldView {
    return {
      resolution: () => {
        const { gameSize, displaySize } = this.scale;
        return {
          width: gameSize.width,
          height: gameSize.height,
          zoom: displaySize.width / gameSize.width,
        };
      },
      room: () => this.#state.currentRoom,
      phase: () => this.#state.phase,
      wren: () => ({ x: this.#wrenX, y: this.#wrenY }),
      lore: () => {
        const propId = this.#examinablePropId();
        return propId ? loreForProp(this.#state, propId) : null;
      },
      grist: () => this.#run.wallet.grist,
      shards: () => this.#run.shards,
      pendingChoiceShard: () => this.#run.pendingChoiceShard,
      examineNearest: () => {
        // Teleport Wren onto the sign so the range gate passes, then examine.
        this.#wrenX = FieldLayout.signX;
        this.#wrenY = FieldLayout.signY;
        this.#moveTo = null;
        this.#pendingExamine = false;
        this.#syncWren();
        this.#examineNearest();
      },
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
    };
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

/**
 * Clamp a signed scalar to the -1..1 range used as a fractional step component
 * for tap-to-move; preserves sub-unit magnitude so diagonal approach stays
 * smooth while keeping each axis within a unit step.
 * @param value - The raw axis component.
 * @returns The clamped component in [-1, 1].
 */
function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
