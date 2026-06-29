/**
 * Deterministic battle-driving helpers for the verification (UAT) bridge. Pure
 * functions over an attached {@link BattleView} that play a seeded encounter the
 * way the e2e suite needs — land a single Strike, or auto-play the launched fight
 * to a terminal outcome. Extracted from `uat/bridge.ts` so the bridge stays a
 * thin view-router under its line budget and the auto-play policy lives in one
 * readable place. No Phaser, no RNG of its own — it only reads the view's state
 * and pushes actions back through the view (the sim owns determinism).
 * @module uat/battle-driver
 */
import { BattleSides } from "../logic/combat";
import { type BattleView } from "./bridge";

/** AP cost of the flux Spark — the auto-play action when Wren can afford it. */
const SPARK_AP_COST = 4;
/** Default hard cap on auto-play decision iterations (stalemate guard). */
const DEFAULT_MAX_TURNS = 400;

/**
 * Drive a Strike from the front party member at the first standing enemy — the
 * canonical "an agent landed a hit" verification action. No-op when there is no
 * battle state or no standing enemy.
 * @param view - The attached battle view to act on.
 * @returns void
 */
export function strikeView(view: BattleView): void {
  const state = view.state();
  if (!state) {
    return;
  }
  const targetIndex = state.enemies.findIndex(enemy => enemy.hp > 0);
  if (targetIndex < 0) {
    return;
  }
  view.act({
    kind: "strike",
    actor: { side: BattleSides.party, index: 0 },
    target: { side: BattleSides.enemies, index: targetIndex },
  });
}

/**
 * Drive one auto-play turn against an attached battle view: cast Spark when Wren
 * can afford the AP, else a free Strike, at the first standing enemy. Returns the
 * terminal phase when the battle has ended (or there is nothing to act on), or
 * null when the fight is still live and the caller should keep driving.
 * @param view - The attached battle view to act on.
 * @returns The terminal phase to stop on, or null to continue.
 */
function driveAutoTurn(view: BattleView): string | null {
  const state = view.state();
  if (!state) {
    return "";
  }
  if (state.phase === "won" || state.phase === "lost") {
    return state.phase;
  }
  const targetIndex = state.enemies.findIndex(enemy => enemy.hp > 0);
  if (targetIndex < 0) {
    return state.phase;
  }
  const wrenAp = state.party[0]?.ap ?? 0;
  const actor = { side: BattleSides.party, index: 0 } as const;
  const target = { side: BattleSides.enemies, index: targetIndex } as const;
  view.act(
    wrenAp >= SPARK_AP_COST
      ? { kind: "craft", id: "spark", actor, target }
      : { kind: "strike", actor, target }
  );
  return null;
}

/**
 * Deterministically play the launched battle to a terminal outcome — the "an
 * agent fought the encounter to the end on the live canvas" driver the Field↔
 * Battle e2e (#82) uses to prove a launched fight resolves and control returns to
 * the Field. Each turn it advances to the next player decision, then casts the
 * flux Spark (the slice's strongest single-target action — ×1.5 on the flux-weak
 * construct/Ashling, building Pressure → Break) when Wren can afford the AP, else
 * a free Strike, at the first standing enemy. Bounded by `maxTurns` so a stalemate
 * can never hang the suite.
 *
 * The view is read through `currentView` **each turn**, not captured once: a
 * resolution may swap the scene (Battle → Field) mid-drive, after which the
 * battle view is detached (the provider returns null) and there is nothing left
 * to act on. Returns "" when there is no battle to drive.
 * @param currentView - Reads the live battle view (null once detached).
 * @param maxTurns - The hard cap on decision iterations (default 400).
 * @returns The terminal phase reached (`"won"` / `"lost"`), or "" outside a battle.
 */
export function autoWinView(
  currentView: () => BattleView | null,
  maxTurns = DEFAULT_MAX_TURNS
): string {
  for (let turn = 0; turn < maxTurns; turn += 1) {
    const view = currentView();
    if (!view) {
      return "";
    }
    view.advanceTurn();
    const phase = driveAutoTurn(view);
    if (phase !== null) {
      return phase;
    }
  }
  return currentView()?.state()?.phase ?? "";
}
