/**
 * Unit coverage for **Halcyon's party-membership persistence across reload** (#146,
 * PRD #43) — the persistence half of the issue's acceptance scenario 2:
 *
 *   Given Halcyon has joined the party
 *   When the agent reloads the game
 *   Then Halcyon is restored to the party roster from IndexedDB with her stats and kit
 *   intact.
 *
 * Halcyon is a runtime mutation, never a starting condition: `freshSave()` MUST stay
 * `party: []`. Once she defects, the run's roster projects into the *already-existing*
 * `SaveDataV2.party` (`readonly SavedPartyMember[]`) via {@link rosterToSavedParty} —
 * no schema-shape change, no `SAVE_VERSION` bump. A save carrying Halcyon round-trips
 * deep-equal through `serialize`/`deserialize` (AC7 exactness), and the validator
 * `asCurrentSave`/`asPartyMember` accepts her id. These are proven headless (no DOM /
 * IndexedDB) so they run under vitest; the in-game reload journey is the e2e twin.
 * ZERO Phaser imports by design.
 */
import { describe, expect, it } from "vitest";

import { PARTY, PartyMemberIds } from "../../src/content";
import { chooseAtBoundSite, openBoundSite } from "../../src/logic/region";
import { REGIONS, RegionIds } from "../../src/content";
import { newMoralLedger } from "../../src/logic/free-vs-wield";
import {
  openRequiemHall,
  playRequiemHallToCompletion,
} from "../../src/logic/region";
import {
  applyHalcyonDefection,
  rosterToSavedParty,
} from "../../src/logic/party/defection";
import {
  asCurrentSave,
  deserialize,
  freshSave,
  serialize,
  type CurrentSave,
} from "../../src/logic/save";

/** The Roots / the Deep region — the one that hosts the Sidhe requiem-hall. */
const ROOTS = REGIONS[RegionIds.roots];
/** A fixed boot seed so the suite is reproducible. */
const SEED = 0x4_e_91;

/**
 * A save carrying the post-defection roster (wren, tobi, halcyon) projected into the
 * persisted party. Built from the real defection reducer so the persisted member set
 * is exactly what the gameplay path produces.
 * @returns A v2 save whose party includes Halcyon.
 */
function saveWithHalcyon(): CurrentSave {
  const run = chooseAtBoundSite(
    openBoundSite(ROOTS, newMoralLedger()),
    "free"
  ).run;
  const requiem = playRequiemHallToCompletion(
    openRequiemHall(ROOTS, run, "reach", SEED)
  );
  const joined = applyHalcyonDefection(run, requiem);
  return {
    ...freshSave(),
    party: rosterToSavedParty(joined.roster),
    worldState: "reach",
  };
}

describe("Halcyon persistence — freshSave stays empty (#146)", () => {
  it("a new game has NO party — Halcyon is never a starting condition", () => {
    expect(freshSave().party).toEqual([]);
  });
});

describe("Halcyon persistence — the roster→SavedParty projection (#146)", () => {
  it("projects each roster id to its persisted member from the PARTY table", () => {
    const projected = rosterToSavedParty([
      PartyMemberIds.wren,
      PartyMemberIds.tobi,
      PartyMemberIds.halcyon,
    ]);
    expect(projected).toEqual([
      // Wren carries her starting Emberwisp shard, so it persists with its mode.
      {
        id: PartyMemberIds.wren,
        level: PARTY.wren.level,
        shard: PARTY.wren.shard,
        shardMode: "wield",
      },
      // Tobi + Halcyon defect/start shard-less — no shard, no orphan shardMode.
      { id: PartyMemberIds.tobi, level: PARTY.tobi.level },
      { id: PartyMemberIds.halcyon, level: PARTY.halcyon.level },
    ]);
  });

  it("includes Halcyon's authored level (her stats/kit resolve by id from PARTY)", () => {
    const halcyon = rosterToSavedParty([PartyMemberIds.halcyon])[0]!;
    expect(halcyon.id).toBe(PartyMemberIds.halcyon);
    expect(halcyon.level).toBe(PARTY.halcyon.level);
    // The persisted member references by id; her stat block + kit live in PARTY,
    // restored by id on load — the projection carries no shard (she defects shard-less).
    expect(halcyon.shard).toBeUndefined();
    expect(halcyon.shardMode).toBeUndefined();
  });
});

describe("Halcyon persistence — round-trip exactness (#146 — scenario 2 / AC7)", () => {
  it("a save carrying Halcyon serialize→deserialize is deep-equal", () => {
    const save = saveWithHalcyon();
    const restored = deserialize(serialize(save));
    expect(restored).not.toBeNull();
    expect(restored).toEqual(save);
  });

  it("the restored party still contains Halcyon with her level intact", () => {
    const restored = deserialize(serialize(saveWithHalcyon()));
    const halcyon = restored!.party.find(
      member => member.id === PartyMemberIds.halcyon
    );
    expect(halcyon).toBeDefined();
    expect(halcyon!.level).toBe(PARTY.halcyon.level);
  });

  it("asCurrentSave accepts a payload whose party includes Halcyon", () => {
    const save = saveWithHalcyon();
    // The untrusted-read gate must accept Halcyon's id (any string id is accepted).
    expect(asCurrentSave(JSON.parse(serialize(save)))).toEqual(save);
  });
});
