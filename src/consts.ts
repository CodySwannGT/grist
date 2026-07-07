/**
 * Typed constants for the game: scene keys, the cross-cutting battle event name,
 * and the side-view battle layout / timing tunables. Never inline these as magic
 * strings/numbers in game code — import from here so a rename is a single edit and
 * a typo is a compile error.
 *
 * The Marrow's structural tones and the grist-gold highlight derive from the
 * canonical {@link GristPalette} / {@link GRIST_GOLD} (`logic/render/palette`, the
 * PD-3.9 / #114 desaturation + grist-gold pass) so the demo grade is coherent across
 * the field and region surfaces and the gold can never drift between a shape fill
 * and its label.
 * @module consts
 */
import { Elements, type ElementId } from "./logic/combat/types";
import {
  GRIST_GOLD,
  GRIST_GOLD_CSS,
  GristPalette,
} from "./logic/render/palette";

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
  /**
   * The Title / main-menu front door (#226) — the DEFAULT cold-boot target for a
   * plain URL. It offers New Game (→ the Ch.1 opening → Field) and a save-gated
   * Continue (→ the Field with the saved run). The `?scene=`/`?start=` seams still
   * route directly to any scene below (they are the DEV/UAT verification entry
   * points, not the player path); only the no-param default changed from Battle.
   */
  Title: "Title",
  Battle: "Battle",
  Field: "Field",
  Bench: "Bench",
  Dialogue: "Dialogue",
  Region: "Region",
  Menu: "Menu",
  /**
   * The world-map travel front door (#241) — the full-screen region-select surface
   * reachable from the pause Menu's **Map** entry (and the `?scene=worldmap` UAT
   * seam). It renders the region roster with per-region status, the Reckoning hook,
   * and (post-Reckoning) the Act II reunion frontier + finale entry, and travels the
   * player into a region (which plays its playlist through real battles).
   */
  WorldMap: "WorldMap",
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
 * Cross-cutting audio event names emitted on the EventsCenter bus (never on
 * `game.events`). The {@link import("./services/sound-service").SoundService}
 * publishes {@link AudioEvents.Cue} with the {@link import("./logic/audio")
 * .AudioCueId} every time a temp-audio cue fires; the redundant on-screen caption
 * view ({@link import("./ui/cue-caption").CueCaptionView}) subscribes and shows
 * the cue's text/icon, so every audio moment carries a non-color/non-audio cue
 * (FR11 / AC12) that can never drift from the sound.
 */
export const AudioEvents = {
  Cue: "audio-cue",
} as const;

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

/** Battle chrome colors (bars, ground line, downed dim over the real art). */
export const BattleColors = {
  groundLine: 0x39455c,
  downedTint: 0x4a4f5a,
  hpBarBg: 0x2a2030,
  hpBarFill: 0x57c969,
  atbBarBg: 0x1d2738,
  atbBarFill: 0x4cc2e0,
  title: "#ffd166",
  /** The tint held on a Broken combatant while it stays vulnerable (#201). */
  brokenTint: 0xff8f8f,
} as const;

/**
 * The combat color language (art-direction §"Elemental color coding") as the
 * tints the render layer multiplies onto each element's craft-FX strip so an
 * action reads by element: Flux cyan-white, Ash grey-violet, Iron steel-orange,
 * Bloom warm green-gold, Gloom void-black. Because a tint MULTIPLIES the strip's
 * pixels, a pure black (0x000000) would erase the FX — so Gloom is the darkest,
 * most-desaturated tone (a deep violet-black) that still reads as void while
 * keeping the strip legible. `neutral` is the un-elemental (Strike) flavor and
 * `break` is the Pressure→Break burst (grist-gold, {@link GRIST_GOLD}).
 */
export const FxColors: Readonly<
  Record<ElementId | "neutral" | "break", number>
> = {
  [Elements.flux]: 0xaef7ff,
  [Elements.ash]: 0xb7a2d6,
  [Elements.iron]: 0xe0912f,
  [Elements.bloom]: 0xc4e06a,
  [Elements.gloom]: 0x3b3350,
  neutral: 0xffffff,
  break: GRIST_GOLD,
};

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
  /**
   * The scene to return to when the fight resolves (#241). Defaults to the Field when
   * absent — every existing Field↔Battle launch is unchanged — but a region encounter
   * launched from the World Map's region runner sets it to {@link SceneKeys.Region} so
   * the win flows back into the region's playlist progression rather than the Field.
   */
  readonly returnTo?: string;
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
  /**
   * True when the Field is being re-entered from the pause Menu (#233): restore the
   * stashed session AND Wren's exact render position (no battle result to consume,
   * no room advance), so closing the menu drops the player back exactly where they
   * paused — distinct from `resumed`, which respawns Wren after a fight.
   */
  readonly fromMenu?: boolean;
}

/**
 * The typed scene-data a gameplay surface hands to the pause Menu when it opens it
 * (#233): the scene key to return to when the menu is closed with Cancel/Back, so
 * the Menu resumes the caller exactly where the player was rather than cold-starting
 * anything. Absent when the Menu is reached standalone via the `?scene=menu` seam —
 * that menu has no caller and Cancel simply stays put.
 */
export interface MenuLaunchData {
  /** The caller scene key to resume on close (e.g. {@link SceneKeys.Field}). */
  readonly returnTo: string;
}

/**
 * The typed scene-data the pause Menu hands to the growth/bench screen when it opens
 * it via **Builds** (#239): the scene to return to when the Bench is closed with
 * Back/Esc, plus the payload that return scene needs to resume ITS own caller. The
 * Bench predates player-facing navigation, so it had no exit the moment Builds began
 * routing players into it; this gives it the symmetric caller-handoff the Field↔Menu
 * leg (#233) already uses. Absent when the Bench is reached standalone via the
 * `?scene=bench` seam — that bench has no caller and Back simply stays put.
 */
export interface BenchLaunchData {
  /** The caller scene key to resume on Back/Esc (e.g. {@link SceneKeys.Menu}). */
  readonly returnTo: string;
  /**
   * The launch payload handed to {@link returnTo} so it can resume its own caller:
   * opened from Builds, the Menu was itself opened over the Field, so closing the
   * Bench re-opens the Menu with this {@link MenuLaunchData} and the Menu's own Esc
   * then drops the player back on the Field exactly where they paused. Absent when
   * the Menu that opened the Bench was itself standalone.
   */
  readonly resume?: MenuLaunchData;
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

/**
 * Field (Marrow) placeholder-art and chrome colors (programmatic art only — no
 * assets). The structural tones (floor / wall / wall-line) come from the canonical
 * desaturated {@link GristPalette}, and the interactable/room-name highlights from
 * the one warm {@link GRIST_GOLD} — this is the "the Marrow uses the desaturation +
 * grist-gold palette" pass (#114). Wren and the prompt keep their readable accents.
 */
export const FieldColors = {
  floor: GristPalette.floor,
  wall: GristPalette.wall,
  wallLine: GristPalette.line,
  sign: GRIST_GOLD,
  signGlyph: GristPalette.base,
  loreBoxFill: 0x0d111a,
  loreBoxStroke: GristPalette.line,
  loreText: "#e8e8ea",
  roomName: GRIST_GOLD_CSS,
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

/**
 * Cross-cutting bench (growth screen) event names emitted on the EventsCenter bus
 * (never on `game.events`). The Bench HUD publishes a device-tagged semantic
 * {@link BenchIntent} as `Input` when the player taps the equip button or a sink
 * button; the Bench scene subscribes and threads the intent through the pure
 * run-state reducers (`equipShardAtBench` / `applyBenchSink`). Raw pointers never
 * leave the HUD — only these named intents do (the bench counterpart of
 * {@link FieldEvents.Input}).
 */
export const BenchEvents = {
  Input: "bench-input",
} as const;

/**
 * Bench-scene layout in logical (384×216) pixels. The growth screen is a static
 * menu: an equip row at the top, a stacked list of grist sinks below, and the
 * shared-grist readout in the corner. First-pass — the *shape* (a labelled equip
 * affordance over a vertical list of costed sink buttons) is the contract, not
 * the exact constants.
 */
export const BenchLayout = {
  /** Centered title banner Y. */
  titleY: 8,
  /** Shared-grist readout (top-left). */
  gristX: 8,
  gristY: 24,
  /** The equip-shard button. */
  equipX: 192,
  equipY: 60,
  equipWidth: 220,
  equipHeight: 22,
  /** The first sink button's center; subsequent buttons stack below by `rowGap`. */
  sinkX: 192,
  firstSinkY: 110,
  sinkWidth: 280,
  sinkHeight: 26,
  rowGap: 34,
  /** Cinder learning-progress bar (under the sink list). */
  progressX: 52,
  progressY: 190,
  progressWidth: 280,
  progressHeight: 8,
  /**
   * The tappable Back control (#239) — the pointer-first Bench's visible exit, a
   * 9-slice button in the top-right chrome that returns to the pause Menu (which
   * then resumes the Field). Kept clear of the top-left grist readout.
   */
  backX: 344,
  backY: 15,
  backWidth: 68,
  backHeight: 18,
  /** The "[Esc] back" affordance hint, centered along the bottom. */
  hintY: 207,
} as const;

/** Bench placeholder-art and chrome colors (programmatic art only — no assets). */
export const BenchColors = {
  backdrop: 0x141821,
  title: "#ffd166",
  grist: "#9be7c4",
  buttonFill: 0x222a39,
  buttonFillDisabled: 0x1a1f2a,
  buttonStroke: 0x39455c,
  buttonStrokeEquipped: 0x57c969,
  buttonText: "#e8e8ea",
  buttonTextDisabled: "#5a606c",
  progressBg: 0x1d2738,
  progressFill: 0xd0706f,
  progressLabel: "#9be7c4",
  /** The muted "[Esc] back" hint (matches the Menu/Field chrome hint tone). */
  hint: "#5a606c",
} as const;

/**
 * Bench-scene text styles (monospace chrome). Kept here with the other typed
 * Bench constants so the scene stays a thin renderer and a color/size change is a
 * single edit. The shapes match Phaser's text-style object.
 */
export const BenchTextStyles = {
  /** The centered "Growth — The Bench" title banner. */
  title: {
    fontFamily: "monospace",
    fontSize: "12px",
    color: BenchColors.title,
  },
  /** The shared-grist readout. */
  grist: {
    fontFamily: "monospace",
    fontSize: "10px",
    color: BenchColors.grist,
  },
  /** A sink/equip button label. */
  button: {
    fontFamily: "monospace",
    fontSize: "9px",
    color: BenchColors.buttonText,
  },
  /** The Cinder progress-bar caption. */
  progress: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: BenchColors.progressLabel,
  },
  /** The bottom "[Esc] back" affordance hint (#239). */
  hint: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: BenchColors.hint,
  },
} as const;

/**
 * Cross-cutting dialogue/cutscene event names emitted on the EventsCenter bus
 * (never on `game.events`). Two stages: the live
 * {@link import("./services/dialogue-input").DialogueInputService} publishes a
 * device-tagged semantic {@link DialogueEvents.Intent} from raw keyboard/pointer
 * (advance / skip / choose-Nth); the Dialogue scene subscribes, resolves a
 * `choose` index to the current node's choice id, and re-publishes the resolved
 * {@link DialogueEvents.Input} ({@link import("./logic/narrative")
 * .DialoguePresenterInput}); the presenter adapter ({@link import("./ui/dialogue")
 * .DialoguePresenter}) subscribes to `Input` and folds it through the pure
 * presenter reducers. Raw keys/pointers never leave the input service; only these
 * named intents do (the dialogue counterpart of {@link FieldEvents.Input}).
 */
export const DialogueEvents = {
  /** The resolved presenter input the adapter consumes (advance / branch / skip). */
  Input: "dialogue-input",
  /** The device-tagged semantic intent the input service publishes (advance / skip / choose-Nth). */
  Intent: "dialogue-intent",
} as const;

/**
 * Render depth of the dialogue presenter chrome, above field/battle/bench chrome
 * so a played cutscene overlays the scene beneath it.
 */
export const DIALOGUE_DEPTH = 200;

/**
 * Dialogue-presenter layout in logical (384×216) pixels: a bottom caption box with
 * a left portrait slot, the speaker name above the caption, and a right-aligned
 * vertical list of branch-choice buttons rendered at a fork. First-pass — the
 * *shape* (a portrait + speaker + caption banner with optional stacked choices) is
 * the contract, not the exact constants.
 */
export const DialogueLayout = {
  /** The caption banner box (bottom of the screen). */
  boxX: 8,
  boxY: 158,
  boxWidth: 368,
  boxHeight: 50,
  /** The square portrait slot inset into the box's left edge. */
  portraitX: 14,
  portraitY: 164,
  portraitSize: 38,
  /** The speaker-name label (above the caption, right of the portrait). */
  speakerX: 60,
  speakerY: 163,
  /** The wrapped caption body (right of the portrait). */
  captionX: 60,
  captionY: 176,
  captionWrapWidth: 308,
  /**
   * Branch-choice buttons: a right-aligned vertical list stacked downward above the
   * caption box. The stack is sized so up to four choices sit fully above `boxY`
   * (158): the 4th slot's bottom is `choiceTopY + 3*(choiceHeight+choiceGap) +
   * choiceHeight = 88 + 3*17 + 14 = 153`, clear of the box — no overlap.
   */
  choiceRightX: 372,
  choiceTopY: 88,
  choiceWidth: 150,
  choiceHeight: 14,
  choiceGap: 3,
  choicePadX: 6,
} as const;

/** Dialogue presenter chrome colors (programmatic art only — no assets). */
export const DialogueColors = {
  boxFill: 0x0d111a,
  boxStroke: 0x39455c,
  portraitFill: 0x222a39,
  portraitStroke: 0xffd166,
  speaker: "#ffd166",
  caption: "#e8e8ea",
  choiceFill: 0x222a39,
  choiceStroke: 0x39455c,
  choiceText: "#9be7c4",
} as const;

/**
 * Dialogue-presenter text styles (monospace chrome). Kept here with the other
 * typed Dialogue constants so the presenter stays a thin renderer and a color/size
 * change is a single edit. The shapes match Phaser's text-style object.
 */
export const DialogueTextStyles = {
  /** The speaker-name label above the caption. */
  speaker: {
    fontFamily: "monospace",
    fontSize: "9px",
    color: DialogueColors.speaker,
  },
  /** The wrapped caption body. */
  caption: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: DialogueColors.caption,
    wordWrap: { width: DialogueLayout.captionWrapWidth },
  },
  /** A branch-choice button label. */
  choice: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: DialogueColors.choiceText,
  },
} as const;

/**
 * Region-scene layout in logical (384×216) pixels (#137). The booted region renders
 * as a side-view (decision 0006): a horizon line splits a sky band from a ground
 * band, the region name banners the top, and the encounter playlist renders as a
 * row of markers along the ground that fill in as the harness clears them. The
 * *shape* (a side-view backdrop + a per-encounter progression readout + a phase
 * caption) is the contract, not the exact constants.
 */
export const RegionLayout = {
  /** Y of the horizon line splitting the side-view sky from the ground. */
  horizonY: 132,
  /** Centered region-name banner Y. */
  titleY: 8,
  /** Phase/progress caption Y (under the title). */
  captionY: 24,
  /** The first encounter marker's center; subsequent markers step right by `markerGap`. */
  markerX: 40,
  markerY: 168,
  markerSize: 16,
  markerGap: 30,
} as const;

/** Region-scene placeholder-art and chrome colors (programmatic art only — no assets). */
export const RegionColors = {
  /** The side-view sky band (above the horizon). */
  sky: 0x1b2733,
  /** The side-view ground band (below the horizon). */
  ground: 0x2a2018,
  /** The horizon divider line. */
  horizon: 0x4a3a2a,
  /** An uncleared encounter marker. */
  markerPending: 0x4a4f5a,
  /** A cleared encounter marker (the grist-gold signal). */
  markerCleared: GRIST_GOLD,
  /** The boot-failure overlay (a region that threw on boot). */
  bootError: 0xd0706f,
  title: GRIST_GOLD_CSS,
  caption: "#9be7c4",
  errorText: "#ffd1d1",
} as const;

/**
 * Region-scene text styles (monospace chrome). Kept here with the other typed
 * Region constants so the scene stays a thin renderer and a color/size change is a
 * single edit. The shapes match Phaser's text-style object.
 */
export const RegionTextStyles = {
  /** The centered region-name banner. */
  title: {
    fontFamily: "monospace",
    fontSize: "12px",
    color: RegionColors.title,
  },
  /** The phase/progress caption under the title. */
  caption: {
    fontFamily: "monospace",
    fontSize: "9px",
    color: RegionColors.caption,
  },
  /** The boot-failure caption a thrown region surfaces. */
  error: {
    fontFamily: "monospace",
    fontSize: "9px",
    color: RegionColors.errorText,
  },
} as const;
