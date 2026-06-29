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
  GameView,
  SceneKeys,
} from "../consts";
import { MARROW_MAP, MarrowRoomIds } from "../content";
import {
  loreForProp,
  startField,
  stepField,
  type FieldState,
} from "../logic/field";
import { eventsCenter } from "../services/events";
import { FieldInputService } from "../services/field-input";
import {
  type FieldIntent,
  type FieldMoveDir,
} from "../services/field-input-map";
import { verifyBridge, type FieldView } from "../uat/bridge";

/** Fallback seed when none is supplied via the verification bridge / `?seed=`. */
const DEFAULT_SEED = 0x9e3779b1;
/** The examinable rendering-notice prop placed in Room A. */
const SIGN_PROP_ID = "warren-sign";

const ROOM_NAME_STYLE = {
  fontFamily: "monospace",
  fontSize: "10px",
  color: FieldColors.roomName,
} as const;
const PROMPT_STYLE = {
  fontFamily: "monospace",
  fontSize: "8px",
  color: FieldColors.prompt,
} as const;
const LORE_STYLE = {
  fontFamily: "monospace",
  fontSize: "8px",
  color: FieldColors.loreText,
  wordWrap: { width: FieldLayout.loreBoxWidth - 8 },
} as const;

/** Renders a {@link FieldState} and emits field actions; holds no field rules. */
export class Field extends Phaser.Scene {
  #state!: FieldState;
  #input!: FieldInputService;
  /** Wren's live logical (384×216) center — adapter render state, not sim state. */
  #wrenX: number = FieldLayout.wrenSpawnX;
  #wrenY: number = FieldLayout.wrenSpawnY;
  /** A pending tap-to-move destination, or null when walking from held keys. */
  #moveTo: { x: number; y: number } | null = null;
  #wren!: Phaser.GameObjects.Rectangle;
  #sign!: Phaser.GameObjects.Rectangle;
  #loreBox!: Phaser.GameObjects.Rectangle;
  #loreText!: Phaser.GameObjects.Text;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Field);
  }

  /**
   * Build the field session under the seed, the semantic input service, the
   * room backdrop, Wren, the rendering-notice sign, and the (hidden) lore banner;
   * subscribe to field intents; wire tap-to-move / tap-to-examine; then expose the
   * scene to the verification bridge.
   * @returns void
   */
  create(): void {
    const seed = verifyBridge.takeSeed() ?? DEFAULT_SEED;
    this.#state = startField(seed);
    this.#wrenX = FieldLayout.wrenSpawnX;
    this.#wrenY = FieldLayout.wrenSpawnY;
    this.#moveTo = null;
    this.#input = new FieldInputService(this);

    this.#drawBackdrop();
    this.#buildProps();
    this.#buildHud();
    this.#wirePointer();

    eventsCenter.on(FieldEvents.Input, this.#onIntent);
    this.#syncWren();

    verifyBridge.attach(SceneKeys.Field, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());
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
    if (dir.dx !== 0 || dir.dy !== 0) {
      const stepPx = (FieldLayout.moveSpeed * delta) / 1000;
      this.#wrenX += dir.dx * stepPx;
      this.#wrenY += dir.dy * stepPx;
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
        this.#moveTo = null;
        return { dx: 0, dy: 0 };
      }
      // A fractional direction toward the target; the caller scales by delta.
      return {
        dx: clampUnit(dx / len),
        dy: clampUnit(dy / len),
      } as FieldMoveDir;
    }
    return { dx: 0, dy: 0 };
  }

  /**
   * Field-intent handler: a held `move` is polled in {@link update}, so here we
   * only act on `move-to` (tap destination) and `examine`. A stable arrow field
   * so it can be unsubscribed by reference on shutdown.
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
      this.#examineNearest();
    }
  };

  /**
   * Examine the prop nearest Wren, if she is within its examine radius: thread an
   * `examine` action through the pure sim, then surface the resulting lore beat.
   * The sim owns whether the prop is examinable and the authored text.
   * @returns void
   */
  #examineNearest(): void {
    const sign = MARROW_MAP[MarrowRoomIds.a].props.find(
      prop => prop.id === SIGN_PROP_ID
    );
    if (!sign) {
      return;
    }
    const within =
      Math.hypot(
        this.#wrenX - FieldLayout.signX,
        this.#wrenY - FieldLayout.signY
      ) <= FieldLayout.examineRadius;
    if (!within) {
      return;
    }
    this.#state = stepField(this.#state, {
      kind: "examine",
      propId: SIGN_PROP_ID,
    });
    this.#renderLore();
  }

  /**
   * Paint the top-down room: a dark back wall, the lit floor band below the wall
   * line, and the dividing wall line.
   * @returns void
   */
  #drawBackdrop(): void {
    const { width, height } = GameView;
    this.add
      .rectangle(0, 0, width, FieldLayout.wallY, FieldColors.wall)
      .setOrigin(0, 0);
    this.add
      .rectangle(
        0,
        FieldLayout.wallY,
        width,
        height - FieldLayout.wallY,
        FieldColors.floor
      )
      .setOrigin(0, 0);
    this.add
      .rectangle(0, FieldLayout.wallY, width, 1, FieldColors.wallLine)
      .setOrigin(0, 0);
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
   * @returns void
   */
  #renderLore(): void {
    const lore = loreForProp(this.#state, SIGN_PROP_ID);
    const visible = lore !== null;
    this.#loreBox.setVisible(visible);
    this.#loreText.setVisible(visible).setText(lore ?? "");
  }

  /**
   * The live link handed to the verification bridge: the applied integer scale
   * (scene-agnostic, read from the ScaleManager), the current room / phase,
   * Wren's live position (so an e2e can assert it changed after a move), the
   * surfaced lore text, and a deterministic examine entry point.
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
      lore: () => loreForProp(this.#state, SIGN_PROP_ID),
      examineNearest: () => {
        // Walk Wren onto the sign so the examine-radius gate passes, then examine —
        // the deterministic "agent examined the rendering notice" verification path.
        this.#wrenX = FieldLayout.signX;
        this.#wrenY = FieldLayout.signY;
        this.#moveTo = null;
        this.#syncWren();
        this.#examineNearest();
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
