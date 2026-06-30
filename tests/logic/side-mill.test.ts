/**
 * Unit suite for Wren's first side-story beat — **"What the mill took"** (#111,
 * Story #98, PRD #42 FR5/AC7). The beat surfaces a **render-or-not** moral choice:
 * the player either *renders* (the corruption-cost path — what the mill did to
 * Lira, repeated) or *spares* (refuses to spend, the safe path Wren's arc earns).
 *
 * The binding AC is **persistence**: "a moral-ledger flag is persisted and survives
 * save/reload". The persisted ledger is the {@link MoralLedger} the PD-3.0 reducers
 * (`logic/free-vs-wield` `resolveChoice`/`foldLedger`) fold — the ONLY moral tally
 * carried in `SaveDataV2`. The narrative `NarrativeState.flags` ledger is NOT
 * serialized (pending #116), so this beat MUST fold the persisted `MoralLedger`:
 * render maps to `wield` (karma−, corruption accrues) and spare to `free` (karma+,
 * no corruption), so each branch yields a measurably different persisted ledger.
 *
 * Zero Phaser, no RNG — exercised headless under vitest, mirroring the
 * `free-vs-wield` / `bound-site` coverage. The divergence is decided by the
 * player's decision, not chance, so the same inputs reproduce a deep-equal session;
 * and the projected save round-trips through the real `serialize`/`deserialize`, so
 * the persistence half of the AC is proven at the logic level here and empirically
 * on the live canvas in `tests/e2e/side-mill.spec.ts`.
 */
import { describe, expect, it } from "vitest";

import { BOUNDS } from "../../src/content";
import { newMoralLedger } from "../../src/logic/free-vs-wield";
import {
  MILL_BEAT_SHARD,
  type MillBeatSession,
  chooseAtMill,
  isMillBeatSettled,
  millBeatSave,
  millDecisionVariant,
  openMillBeat,
} from "../../src/logic/side-story/mill";
import { deserialize, serialize } from "../../src/logic/save";

describe("openMillBeat — reaching Wren's 'What the mill took' beat (#111)", () => {
  it("opens unsettled, with the render-or-not choice pending on the sited shard", () => {
    const session = openMillBeat(newMoralLedger());
    expect(isMillBeatSettled(session)).toBe(false);
    expect(session.choice.resolved).toBe(false);
    expect(session.run.pendingChoiceShard).toBe(MILL_BEAT_SHARD);
    expect(session.run.shards).toEqual([MILL_BEAT_SHARD]);
  });

  it("starts from the supplied ledger (no choices counted yet)", () => {
    const session = openMillBeat(newMoralLedger());
    expect(session.ledger).toEqual({
      karma: 0,
      freeChoices: 0,
      wieldChoices: 0,
    });
    expect(session.corruptionAccrued).toBe(0);
  });
});

describe("millDecisionVariant — render maps to the cost path, spare to the safe path", () => {
  it("maps render → wield (the corruption-cost carry) and spare → free (the safe carry)", () => {
    // The moral valence: rendering Lira's trace is the spend (wield, karma−);
    // sparing refuses to render (free, karma+). [EVIDENCE: ledger-choice-unit]
    expect(millDecisionVariant("render")).toBe("wield");
    expect(millDecisionVariant("spare")).toBe("free");
  });
});

describe("chooseAtMill — render (the corruption-cost path)", () => {
  it("folds the persisted MoralLedger: karma down, a wield tally, corruption accrues", () => {
    // [EVIDENCE: ledger-choice-unit] the render branch folds the persisted ledger.
    const settled = chooseAtMill(openMillBeat(newMoralLedger()), "render");
    expect(isMillBeatSettled(settled)).toBe(true);
    expect(settled.choice).toEqual({
      resolved: true,
      shard: MILL_BEAT_SHARD,
      variant: "wield",
    });
    expect(settled.ledger.karma).toBe(-1);
    expect(settled.ledger.wieldChoices).toBe(1);
    expect(settled.ledger.freeChoices).toBe(0);
    expect(settled.corruptionAccrued).toBe(
      BOUNDS[MILL_BEAT_SHARD].variants.wield.corruptionRate
    );
    expect(settled.corruptionAccrued).toBeGreaterThan(0);
    expect(settled.run.pendingChoiceShard).toBeNull();
  });
});

describe("chooseAtMill — spare (the safe path)", () => {
  it("folds the persisted MoralLedger: karma up, a free tally, no corruption", () => {
    const settled = chooseAtMill(openMillBeat(newMoralLedger()), "spare");
    expect(settled.choice).toEqual({
      resolved: true,
      shard: MILL_BEAT_SHARD,
      variant: "free",
    });
    expect(settled.ledger.karma).toBe(1);
    expect(settled.ledger.freeChoices).toBe(1);
    expect(settled.ledger.wieldChoices).toBe(0);
    expect(settled.corruptionAccrued).toBe(0);
    expect(settled.run.pendingChoiceShard).toBeNull();
  });
});

describe("chooseAtMill — measurable divergence + alternate fork", () => {
  it("render vs spare yield measurably different persisted ledgers", () => {
    // [EVIDENCE: alternate-fork-flag] the two branches are distinct persisted state.
    const render = chooseAtMill(openMillBeat(newMoralLedger()), "render");
    const spare = chooseAtMill(openMillBeat(newMoralLedger()), "spare");
    expect(render.ledger.karma).not.toBe(spare.ledger.karma);
    expect(render.choice.variant).not.toBe(spare.choice.variant);
    expect(render.corruptionAccrued).not.toBe(spare.corruptionAccrued);
    expect(render.ledger).not.toEqual(spare.ledger);
  });

  it("is a total function — same ledger + decision yields a deep-equal session", () => {
    const a = chooseAtMill(openMillBeat(newMoralLedger()), "render");
    const b = chooseAtMill(openMillBeat(newMoralLedger()), "render");
    expect(a).toEqual(b);
  });

  it("never mutates the supplied ledger", () => {
    const ledger = newMoralLedger();
    chooseAtMill(openMillBeat(ledger), "render");
    expect(ledger).toEqual({ karma: 0, freeChoices: 0, wieldChoices: 0 });
  });
});

describe("chooseAtMill — idempotence (a settled beat cannot re-count)", () => {
  it("a second choice against a settled session is a no-op", () => {
    const first = chooseAtMill(openMillBeat(newMoralLedger()), "render");
    const second = chooseAtMill(first, "spare");
    expect(second.ledger).toEqual(first.ledger);
    expect(second.choice).toEqual(first.choice);
    expect(second.ledger.wieldChoices).toBe(1);
    expect(second.ledger.freeChoices).toBe(0);
  });
});

describe("millBeatSave — the persisted projection round-trips (the AC's persistence half)", () => {
  it("renders a JSON deep-equal round-trippable CurrentSave whose ledger holds the choice", () => {
    // [EVIDENCE: ledger-choice-unit] the projected save carries the folded ledger.
    const settled = chooseAtMill(openMillBeat(newMoralLedger()), "render");
    const save = millBeatSave(settled);
    expect(save.moralLedger).toEqual(settled.ledger);
    expect(save.choice).toEqual(settled.choice);
    // JSON deep-equal round-trippable (no functions / class instances embedded).
    expect(JSON.parse(JSON.stringify(save))).toEqual(save);
  });

  it("survives the real serialize/deserialize cycle byte-for-byte (save/reload)", () => {
    // [EVIDENCE: post-reload-state] the logic-level save/reload proof: a render save
    // deserializes back to the same persisted moral ledger / choice (AC: survives
    // save/reload). The e2e proves the same across a real document boundary.
    const renderSave = millBeatSave(
      chooseAtMill(openMillBeat(newMoralLedger()), "render")
    );
    const reloadedRender = deserialize(serialize(renderSave));
    expect(reloadedRender).not.toBeNull();
    expect(reloadedRender!.moralLedger).toEqual({
      karma: -1,
      freeChoices: 0,
      wieldChoices: 1,
    });
    expect(reloadedRender!.choice.variant).toBe("wield");

    // [EVIDENCE: alternate-fork-flag] the spare fork survives to a DIFFERENT ledger.
    const spareSave = millBeatSave(
      chooseAtMill(openMillBeat(newMoralLedger()), "spare")
    );
    const reloadedSpare = deserialize(serialize(spareSave));
    expect(reloadedSpare!.moralLedger).toEqual({
      karma: 1,
      freeChoices: 1,
      wieldChoices: 0,
    });
    expect(reloadedSpare!.choice.variant).toBe("free");
    expect(reloadedSpare!.moralLedger).not.toEqual(reloadedRender!.moralLedger);
  });

  it("MillBeatSession is plain serializable data", () => {
    const session: MillBeatSession = chooseAtMill(
      openMillBeat(newMoralLedger()),
      "render"
    );
    expect(JSON.parse(JSON.stringify(session))).toEqual(session);
  });
});
