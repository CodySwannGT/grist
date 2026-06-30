import { describe, expect, it } from "vitest";

import { ENCOUNTERS, ENEMIES, EncounterIds, EnemyIds } from "../../src/content";
import {
  CH1_OPENING_SCENE_ID,
  CH1_REVEAL_NODE_ID,
  CH1_SCRIPT,
  CH1_AMBUSH_ENCOUNTER,
  SABLE_REVEALED_FLAG,
} from "../../src/content/scenes/ch1";
import {
  advanceScene,
  initialNarrativeState,
  readLedgerFlag,
  writeLedgerFlag,
  type NarrativeState,
} from "../../src/logic/narrative";

/**
 * Ch.1 "The delivery" content (#105 / PD-3.2). Asserts the genuinely-new Ch.1
 * data authored over the Phase-2 engine: the scripted opening scene/dialogue
 * graph (the smuggling run → reach the drop → the cargo opens to reveal Sable →
 * the ambush), the `sable-revealed` flag the reveal beat writes, and the tutorial
 * ambush `EncounterDef` (a single weak House-Mourne ambusher, deterministically
 * winnable under a fixed seed). Pure data + the pure narrative reducers — zero
 * Phaser. The sim is NOT forked: the encounter is the Phase-2 schema and the
 * scene consumes #91's model verbatim.
 */

describe("Ch.1 tutorial ambush encounter (#105 AC3)", () => {
  it("defines a weak House-Mourne ambusher (winnable tutorial fight)", () => {
    const enforcer = ENEMIES[EnemyIds.houseEnforcer];
    expect(enforcer.name).toMatch(/Mourne/i);
    // Weaker than the Phase-1 scrapper (HP40) so a fresh party clears it under a
    // fixed seed via the deterministic autoWin driver — no flaky RNG, no soft-lock.
    expect(enforcer.stats.hp).toBeLessThanOrEqual(28);
    expect(enforcer.stats.hp).toBeGreaterThan(0);
    expect(enforcer.lootGrist).toBeGreaterThan(0);
    // id ≡ table key (mapped-type contract — can never drift).
    expect(enforcer.id).toBe(EnemyIds.houseEnforcer);
  });

  it("the tutorial-ambush encounter fields exactly the ambusher on the marrow backdrop", () => {
    const ambush = ENCOUNTERS[EncounterIds.tutorialAmbush];
    expect(ambush.enemies).toEqual([EnemyIds.houseEnforcer]);
    expect(ambush.backdrop).toBe("marrow");
    expect(ambush.id).toBe(EncounterIds.tutorialAmbush);
    // The Ch.1 module names this exact encounter (no dangling reference).
    expect(CH1_AMBUSH_ENCOUNTER).toBe(EncounterIds.tutorialAmbush);
    expect(ENCOUNTERS[CH1_AMBUSH_ENCOUNTER]).toBeDefined();
  });
});

describe("Ch.1 scripted opening scene (#105 AC1/AC2)", () => {
  it("the opening scene is the script's entry and walks multiple beats", () => {
    const opening = CH1_SCRIPT[CH1_OPENING_SCENE_ID];
    expect(opening).toBeDefined();
    expect(opening?.id).toBe(CH1_OPENING_SCENE_ID);
    // A real authored graph (the smuggling run), not the single-node demo fixture.
    expect(opening?.nodes.length ?? 0).toBeGreaterThan(1);
  });

  it("speaks as Wren and reveals Sable by name", () => {
    const captions = Object.values(CH1_SCRIPT)
      .flatMap(scene => scene.nodes)
      .map(node => node.text)
      .join("\n");
    expect(captions).toMatch(/sable/i);
    const speakers = new Set(
      Object.values(CH1_SCRIPT).flatMap(scene =>
        scene.nodes.map(node => node.speaker)
      )
    );
    expect(speakers.has("wren")).toBe(true);
  });

  it("names a reveal node in the opening, and reaching it folds the sable-revealed flag", () => {
    const opening = CH1_SCRIPT[CH1_OPENING_SCENE_ID]!;
    expect(opening.nodes.some(node => node.id === CH1_REVEAL_NODE_ID)).toBe(
      true
    );

    // Walk the scene; when the cursor reaches the reveal node, fold the flag — the
    // exact thing the Dialogue adapter does, with the reducers staying pure.
    let state: NarrativeState | null = initialNarrativeState(opening);
    expect(state).not.toBeNull();
    let folded = false;
    for (let guard = 0; state && guard < 50; guard += 1) {
      if (state.nodeId === CH1_REVEAL_NODE_ID) {
        state = writeLedgerFlag(state, SABLE_REVEALED_FLAG, true);
        folded = true;
      }
      const next: NarrativeState = advanceScene(state, CH1_SCRIPT);
      if (next.sceneId === state.sceneId && next.nodeId === state.nodeId) {
        break;
      }
      state = next;
    }
    expect(folded).toBe(true);
    expect(readLedgerFlag(state!, SABLE_REVEALED_FLAG)).toBe(true);
  });

  it("the flag ledger survives a JSON round-trip (SaveService-safe)", () => {
    const opening = CH1_SCRIPT[CH1_OPENING_SCENE_ID]!;
    const base = initialNarrativeState(opening)!;
    const written = writeLedgerFlag(base, SABLE_REVEALED_FLAG, true);
    const roundTripped = JSON.parse(JSON.stringify(written)) as NarrativeState;
    expect(roundTripped.flags[SABLE_REVEALED_FLAG]).toBe(true);
  });
});
