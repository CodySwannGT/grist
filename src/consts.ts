/**
 * Typed constants for the game: scene keys, the cross-cutting battle event name,
 * and the side-view battle layout / timing tunables. Never inline these as magic
 * strings/numbers in game code — import from here so a rename is a single edit and
 * a typo is a compile error.
 * @module consts
 */

/**
 * Scene registry keys. The boot flow is Boot → Preloader → Battle: the game boots
 * straight into the side-view battle (decision 0006, V1/V2). The Field scene is
 * registered alongside Battle but only started on demand (`?scene=field`) so the
 * default boot — and every existing battle test — is unchanged; Field↔Battle
 * wiring is a follow-up (#72). Title/menu and the terminal win/lose screens
 * arrive in later sub-tasks.
 */
export const SceneKeys = {
  Boot: "Boot",
  Preloader: "Preloader",
  Battle: "Battle",
  Field: "Field",
} as const;

/**
 * Cross-cutting battle event names emitted on the EventsCenter bus (never on
 * `game.events`). The scene/controller publishes a player/verification-driven
 * {@link import("./logic/combat").BattleAction} as `ActionRequested`; the battle
 * adapter (sim owner) subscribes and threads it through the pure reducer. The
 * semantic {@link import("./services/input").InputService} publishes device-tagged
 * UI intents as `Input`; the HUD controller subscribes and drives the menu. Raw
 * keys/pointers never leave the InputService — only these named intents do.
 */
export const BattleEvents = {
  ActionRequested: "battle-action-requested",
  Input: "battle-input",
} as const;

/** Render depth of the battle HUD, above the pooled combatant views (depth 0). */
export const HUD_DEPTH = 100;

/**
 * The native (internal) render resolution. Locked to 384×216, integer-scaled and
 * landscape-first per decision 0006 (V2). The scene renders against these logical
 * units; the ScaleManager scales the canvas to the viewport by an integer factor.
 */
export const GameView = {
  width: 384,
  height: 216,
} as const;

/**
 * Side-view battle layout (FFVI-style): enemies anchored left, party right, each
 * side a vertically-stacked, slightly depth-staggered column. All units are
 * logical (384×216) pixels. Tuned first-pass; the *shape* (two facing columns over
 * a ground line) is the contract, not the constants.
 */
export const BattleLayout = {
  /** Y of the ground/horizon line dividing the backdrop. */
  groundY: 150,
  /** Center X of the enemy column (left). */
  enemyAnchorX: 100,
  /** Center X of the party column (right). */
  partyAnchorX: 284,
  /** Center Y of the first (front) combatant row. */
  firstRowY: 96,
  /** Vertical distance between stacked combatants on a side. */
  rowGap: 44,
  /** Per-row horizontal stagger toward screen center (depth cue). */
  rowStaggerX: 14,
  /** Placeholder unit body width. */
  unitWidth: 26,
  /** Placeholder unit body height. */
  unitHeight: 38,
  /** HP / ATB bar width. */
  barWidth: 44,
  /** HP bar height. */
  hpBarHeight: 5,
  /** ATB bar height. */
  atbBarHeight: 3,
  /** Gap between the unit's feet and the first bar, and between bars. */
  barGap: 3,
} as const;

/** Battle placeholder-art and chrome colors (programmatic art only — no assets). */
export const BattleColors = {
  backdropSky: 0x141821,
  backdropGround: 0x222a39,
  groundLine: 0x39455c,
  partyTint: 0x6fd08c,
  enemyTint: 0xd0706f,
  downedTint: 0x4a4f5a,
  hpBarBg: 0x2a2030,
  hpBarFill: 0x57c969,
  atbBarBg: 0x1d2738,
  atbBarFill: 0x4cc2e0,
  title: "#ffd166",
} as const;

/**
 * Battle timing. `atbTickMs` is the Normal-speed real-time step at which the
 * adapter applies one ATB `tick` to the sim while a side is filling its gauges;
 * `fastTickMs` is the shorter Fast-speed step (the same number of ticks over less
 * wall-clock — a faster observable cadence). Ticking pauses the moment a combatant
 * is ready to act, and the full-Wait speed pauses it outright (combat-spec).
 */
export const BattleTiming = {
  atbTickMs: 100,
  fastTickMs: 50,
} as const;

/**
 * Cross-cutting field event names emitted on the EventsCenter bus (never on
 * `game.events`). The semantic {@link import("./services/field-input")
 * .FieldInputService} publishes device-tagged field intents (directional MOVE,
 * EXAMINE) as `Input`; the Field scene subscribes and drives Wren's position +
 * prop examination. Raw keys/pointers never leave the FieldInputService — only
 * these named intents do (the field counterpart of {@link BattleEvents.Input}).
 */
export const FieldEvents = {
  Input: "field-input",
} as const;

/**
 * The typed scene-data the Field hands to the Battle scene when an encounter
 * trigger fires (`this.scene.start(SceneKeys.Battle, data)`): the encounter id to
 * run and the deterministic seed. The Battle scene reads this in `init()` and
 * launches the *existing* Phase-1 sim with it — no combat math is added, only the
 * launch payload. Keeping the shape here (not inline) means a field-launch and a
 * battle-init can never drift on the key names.
 */
export interface BattleLaunchData {
  /** The encounter id the Field's trigger fired (one of {@link import("./content").EncounterId}). */
  readonly encounterId: string;
  /** The 32-bit battle seed threaded from the field session for determinism. */
  readonly seed: number;
}

/**
 * The typed scene-data the Battle scene hands back to the Field on return
 * (`this.scene.start(SceneKeys.Field, data)`). The live field session and the
 * consumed battle result both ride the registry (see `services/run-store`) so the
 * Field restores the exact pre-launch session and reads the result once via the
 * one-shot `takeLastBattleResult`; this flag just tells the Field its `create()`
 * is a post-battle resume (restore the stored session) rather than a fresh boot.
 */
export interface FieldResumeData {
  /** True when the Field is being re-entered after a battle (restore the session). */
  readonly resumed: boolean;
}

/**
 * Field-scene layout in logical (384×216) pixels. Wren spawns near the left of
 * Room A and walks the floor band between the wall line and the bottom inset; the
 * rendering-notice sign sits to her right so a rightward walk reaches its examine
 * radius. First-pass — the *shape* (a walkable floor band with placed props) is
 * the contract, not the exact constants.
 */
export const FieldLayout = {
  /** Y of the back-wall / floor divider line. */
  wallY: 70,
  /** Wren's spawn position (logical px). */
  wrenSpawnX: 60,
  wrenSpawnY: 150,
  /** Wren placeholder body size. */
  wrenWidth: 14,
  wrenHeight: 22,
  /** Movement speed in logical px per second (delta-driven; no Math.random). */
  moveSpeed: 90,
  /** Inset from each edge Wren's center is clamped to (keeps her on-screen). */
  edgeInset: 10,
  /** Center of the Room-A rendering-notice sign prop. */
  signX: 300,
  signY: 150,
  /** Sign placeholder size. */
  signWidth: 24,
  signHeight: 30,
  /** Examine radius: Wren must be within this of a prop's center to examine it. */
  examineRadius: 48,
  /** Lore banner box (bottom of the screen) when a prop is examined. */
  loreBoxX: 8,
  loreBoxY: 178,
  loreBoxWidth: 368,
  loreBoxHeight: 32,
} as const;

/** Field placeholder-art and chrome colors (programmatic art only — no assets). */
export const FieldColors = {
  floor: 0x1b2230,
  wall: 0x10141d,
  wallLine: 0x39455c,
  wren: 0x6fd08c,
  sign: 0xffd166,
  signGlyph: 0x141821,
  loreBoxFill: 0x0d111a,
  loreBoxStroke: 0x39455c,
  loreText: "#e8e8ea",
  roomName: "#ffd166",
  prompt: "#9be7c4",
} as const;

/**
 * Field-scene text styles (monospace chrome). Kept here with the other typed
 * Field constants so the scene stays a thin renderer and a color/size change is a
 * single edit. The shapes match Phaser's text-style object.
 */
export const FieldTextStyles = {
  /** The centered room-name banner at the top of the screen. */
  roomName: {
    fontFamily: "monospace",
    fontSize: "10px",
    color: FieldColors.roomName,
  },
  /** The "[E] examine" affordance under the examinable prop. */
  prompt: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: FieldColors.prompt,
  },
  /** The wrapped lore body inside the bottom banner. */
  lore: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: FieldColors.loreText,
    wordWrap: { width: FieldLayout.loreBoxWidth - 8 },
  },
} as const;
