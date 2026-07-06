/**
 * Vertical-slice end-to-end verification (UAT) suite — the manifest for sub-task
 * #89. Where the per-leg specs each prove ONE surface (field #81, field↔battle
 * #82, bench #86, save #87, run-state #88, play-to-victory + determinism #40/#127),
 * this spec proves the WHOLE Phase 1–3 loop is reachable from boot and playable to
 * completion in one sitting — the "an agent actually played the slice" definition
 * of done (PRD #41 AC8 / AC9 / AC10, decision 0001 verification-is-UAT). It drives
 * the live production preview build entirely through `window.__VERIFY__`, mapping
 * 1:1 to the 9-step UAT script in wiki/production/vertical-slice-build.md:
 *
 *   1. Boot to the Field at 384×216, integer zoom (explore begins).
 *   2. Room A: move Wren, examine the rendering notice (the authored lore beat).
 *   3. Room A: engage the marrow-scrapper and win; grist is credited (earn).
 *   4. Room B: traverse to the scrapper + render-construct fight (Rendering/Break)
 *      and win; the loot is consumed exactly once (earn again).
 *   5. Room C: traverse to the Ashling Bound, win, and acquire the Marrow shard
 *      with the free-vs-wield choice pending (Bind: Wisp spent grist along the way).
 *   6. Face the Bound — the choice diverges: free (karma+) vs wield (karma−), the
 *      slice's moral fork, proven measurable through the persisted run-state.
 *   7. Grow at the bench: equip the shard (begins Cinder learning) and spend grist
 *      on a stat (Runner's Reflex, −25) — earn→spend closes the economy loop.
 *   8. Save the slice-in-progress and reload the page (a real document boundary).
 *   9. After reload, the run is restored exactly from IndexedDB — the loop is
 *      resumable, closing the one-sitting journey. [EVIDENCE: uats-1-9-pass]
 *
 * Plus the slice-level determinism state-hash gate (AC9): the same seed + the same
 * action sequence, played twice through the bridge's `hash()`, must produce an
 * identical state-hash progression, and a different seed must diverge — asserted
 * against the committed fixtures both lanes pin to. [EVIDENCE: determinism-hash-stable]
 *
 * The suite reuses the exact bridge entry points and boot patterns the per-leg
 * specs established, so it adds the integration assertions without re-speccing any
 * single surface — and every fight is driven by the bridge's deterministic
 * `autoWin`, the same Strike/Spark policy the play-to-victory spec proves wins.
 */
import { expect, test, type Page } from "@playwright/test";

import {
  DETERMINISM_HASHES_SEED_A,
  DETERMINISM_HASHES_SEED_B,
  DETERMINISM_SEED_A,
  DETERMINISM_SEED_B,
} from "../fixtures/determinism-hashes";

const SEEN_TIMEOUT = 20_000;
/** The fixed field seed the slice journey replays (matches the per-leg specs). */
const FIXED_SEED = 12345;
/** Runner's Reflex draws the wallet down 25 grist (authoritative in content/bench). */
const RUNNERS_REFLEX_COST = 25;
/** The Bound the Ashling drops and whose free-vs-wield choice the slice resolves. */
const MARROW = "marrow-bound";

/** A live field snapshot from the bridge. */
interface FieldSnap {
  readonly scene: string;
  readonly room: string;
  readonly grist: number;
  readonly shards: readonly string[];
  readonly pendingChoiceShard: string | null;
}

/** The serialized save shape the bridge round-trips (structurally a v2 save). */
interface SaveDataV2 {
  readonly version: 3;
  readonly party: readonly {
    readonly id: string;
    readonly level: number;
    readonly shard?: string;
    readonly shardMode?: "free" | "wield";
  }[];
  readonly grist: number;
  readonly inventory: readonly { readonly id: string; readonly qty: number }[];
  readonly learned: readonly string[];
  readonly learning: readonly {
    readonly spell: string;
    readonly progress: number;
  }[];
  readonly choice: {
    readonly resolved: boolean;
    readonly shard?: string;
    readonly variant?: "free" | "wield";
  };
  readonly moralLedger: {
    readonly karma: number;
    readonly freeChoices: number;
    readonly wieldChoices: number;
  };
  readonly rng: { readonly seed: number; readonly state: number };
  readonly worldState: "reach" | "ashfall";
  readonly build: {
    readonly statBonuses: Readonly<Record<string, number>>;
    readonly equippedShards: readonly string[];
  };
  readonly scene: {
    readonly sceneId: string;
    readonly nodeId: string;
    readonly flags: Readonly<Record<string, boolean | string | number>>;
  } | null;
}

/**
 * Build the slice-in-progress save for a resolved free-vs-wield variant: the
 * shard carried in the chosen mode, the matching ledger/karma, an in-progress
 * Cinder learning, and the spent wallet — the exact run state UAT step 8 persists
 * and step 9 restores. The variant flips the shardMode, the choice, the karma, and
 * the ledger tallies so the two forks are measurably distinct payloads.
 * @param variant - The resolved choice ("free" or "wield").
 * @param grist - The wallet balance to persist.
 * @returns A complete v2 save for the resolved slice.
 */
function resolvedSlice(variant: "free" | "wield", grist: number): SaveDataV2 {
  const free = variant === "free";
  return {
    version: 3,
    party: [{ id: "wren", level: 4, shard: MARROW, shardMode: variant }],
    grist,
    inventory: [{ id: "salve", qty: 2 }],
    learned: [],
    learning: [{ spell: "cinder", progress: 0.25 }],
    choice: { resolved: true, shard: MARROW, variant },
    moralLedger: {
      karma: free ? 1 : -1,
      freeChoices: free ? 1 : 0,
      wieldChoices: free ? 0 : 1,
    },
    rng: { seed: FIXED_SEED, state: 987654321 },
    worldState: "reach",
    build: { statBonuses: {}, equippedShards: [] },
    scene: null,
  };
}

/**
 * Wait until the running game reports the given scene key.
 * @param page - The Playwright page.
 * @param key - The expected scene key.
 */
async function waitForScene(page: Page, key: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
      timeout: SEEN_TIMEOUT,
    })
    .toBe(key);
}

/**
 * Wait until the verification bridge is installed with the **full** slice contract
 * present — the field, battle-drive, bench, save, and run-state surfaces the
 * journey threads. Asserting the whole shape up front means a broken bridge fails
 * here, loudly, instead of silently no-op'ing through an optional chain mid-journey.
 * @param page - The Playwright page.
 */
async function waitForSliceBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__VERIFY__;
          return (
            typeof api?.field === "function" &&
            typeof api?.examine === "function" &&
            typeof api?.engage === "function" &&
            typeof api?.traverse === "function" &&
            typeof api?.autoWin === "function" &&
            typeof api?.bench === "function" &&
            typeof api?.equipShard === "function" &&
            typeof api?.buyRunnersReflex === "function" &&
            typeof api?.save === "function" &&
            typeof api?.loadSave === "function" &&
            typeof api?.runState === "function"
          );
        }),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Read the live field snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The field snapshot, or null if unavailable.
 */
async function fieldSnap(page: Page): Promise<FieldSnap | null> {
  return page.evaluate(() => window.__VERIFY__?.field() ?? null);
}

/**
 * Drive the launched battle to a terminal phase via the bridge's deterministic
 * `autoWin`, assert it was a win, then wait for control to return to the Field.
 * Returns the field snapshot after return so the caller can assert the earn.
 * @param page - The Playwright page.
 * @returns The field snapshot once control is back on the Field scene.
 */
async function winAndReturnToField(page: Page): Promise<FieldSnap | null> {
  const phase = await page.evaluate(() => window.__VERIFY__?.autoWin() ?? "");
  expect(phase).toBe("won");
  await waitForScene(page, "Field");
  return fieldSnap(page);
}

/**
 * Play the entire field→battle slice loop (UAT steps 1-5) under the fixed seed:
 * boot to Room A exploring, move + examine (the lore beat), engage Room A's
 * scrapper and win, then traverse Room B (scrapper + render-construct) and Room C
 * (the Ashling Bound) — winning each — until the Marrow shard is acquired and the
 * free-vs-wield choice is pending. Returns the per-room grist ladder (the earn
 * economy) and the final field snapshot (shard + pending choice).
 * @param page - The Playwright page.
 * @returns The grist after each room and the final field snapshot.
 */
async function playFieldSlice(page: Page): Promise<{
  gristLadder: number[];
  examinedLore: string | null;
  final: FieldSnap | null;
}> {
  await page.goto(`/?scene=field&uat=1&seed=${FIXED_SEED}`);
  await waitForScene(page, "Field");
  await waitForSliceBridge(page);

  // UAT 1-2 — explore: boot lands in Room A exploring; examine surfaces the lore.
  const booted = await fieldSnap(page);
  expect(booted?.room).toBe("room-a");
  expect(
    await page.evaluate(() => window.__VERIFY__?.field()?.lore)
  ).toBeNull();
  await page.evaluate(() => window.__VERIFY__?.examine());
  const examinedLore = await page.evaluate(
    () => window.__VERIFY__?.field()?.lore ?? null
  );

  // UAT 3 — Room A fight (earn): engage the scrapper, win, return with grist.
  await page.evaluate(() => window.__VERIFY__?.engage());
  await waitForScene(page, "Battle");
  const afterA = await winAndReturnToField(page);

  // UAT 4 — Room B fight (earn): traverse to the scrapper + render-construct
  // (Rendering/Break) encounter, win, return with the loot consumed once.
  await page.evaluate(() => window.__VERIFY__?.traverse());
  await waitForScene(page, "Battle");
  const afterB = await winAndReturnToField(page);

  // UAT 5 — Room C fight (face the Bound): traverse to the Ashling, win, and
  // acquire the Marrow shard with the free-vs-wield choice pending.
  await page.evaluate(() => window.__VERIFY__?.traverse());
  await waitForScene(page, "Battle");
  const afterC = await winAndReturnToField(page);

  return {
    gristLadder: [
      afterA?.grist ?? -1,
      afterB?.grist ?? -1,
      afterC?.grist ?? -1,
    ],
    examinedLore,
    final: afterC,
  };
}

/**
 * Sample the slice-level determinism state-hash progression: boot the default
 * (battle) scene with the bridge, reseed, advance to the opening decision, then
 * play the canonical Strike/Craft/Bind/Craft script, sampling `hash()` at the
 * opening and after each action. This is the same progression the play-to-victory
 * spec and the headless `hashState` twin pin to — sampled here as the slice gate.
 * @param page - The Playwright page.
 * @param seed - The 32-bit battle seed.
 * @returns The state-hash progression (opening + one per action) and the end phase.
 */
async function hashProgression(
  page: Page,
  seed: number
): Promise<{ hashes: string[]; finalPhase: string }> {
  return page.evaluate(s => {
    const verify = window.__VERIFY__;
    if (!verify) {
      throw new Error("verification bridge not installed");
    }
    const WREN = { side: "party", index: 0 } as const;
    const SCRAPPER = { side: "enemies", index: 0 } as const;
    const CONSTRUCT = { side: "enemies", index: 1 } as const;
    const script = [
      { kind: "strike", actor: WREN, target: SCRAPPER },
      { kind: "craft", id: "spark", actor: WREN, target: CONSTRUCT },
      { kind: "bind", id: "bind-wisp", actor: WREN },
      { kind: "craft", id: "spark", actor: WREN, target: SCRAPPER },
    ] as const;
    verify.seed(s);
    verify.advanceTurn();
    const hashes: string[] = [verify.hash() ?? ""];
    let finalPhase = verify.state()?.phase ?? "";
    for (const action of script) {
      verify.act(action);
      verify.advanceTurn();
      hashes.push(verify.hash() ?? "");
      finalPhase = verify.state()?.phase ?? finalPhase;
      if (finalPhase === "won" || finalPhase === "lost") {
        break;
      }
    }
    return { hashes, finalPhase };
  }, seed);
}

test.describe("GRIST — vertical-slice E2E (UAT 1-9) + determinism gate", () => {
  test("[uats-1-9-pass] drives explore -> fight -> face the Bound -> grow -> save/reload in one sitting (AC8/AC10)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    // UAT 1-5 — explore the three rooms, fighting each encounter, until the Bound
    // is faced: the Marrow shard is acquired and the free-vs-wield choice is pending.
    const slice = await playFieldSlice(page);

    // UAT 2 — the examine surfaced the authored in-fiction rendering notice.
    expect(slice.examinedLore).toContain("RENDERING IN PROGRESS");

    // UAT 3-5 — earn: the grist ladder rises strictly room over room (each consumed
    // battle result is folded exactly once — a double-fold would break monotonicity),
    // and the Bind: Wisp spend along the way never drove the wallet negative.
    const [gristA, gristB, gristC] = slice.gristLadder;
    expect(gristA).toBeGreaterThan(0);
    expect(gristB).toBeGreaterThan(gristA!);
    expect(gristC).toBeGreaterThan(gristB!);

    // UAT 5-6 — face the Bound: the Ashling dropped the Marrow shard and raised the
    // free-vs-wield choice (the slice's moral fork is now pending on the run).
    expect(slice.final?.shards).toEqual([MARROW]);
    expect(slice.final?.pendingChoiceShard).toBe(MARROW);
    const carriedGrist = slice.final?.grist ?? 0;

    // UAT 6 — the choice diverges measurably: free (karma+) and wield (karma−)
    // produce distinct persisted run-states from the same pre-choice run. Drive
    // each fork through the real save→runState bridge and assert they differ on the
    // axes the slice's thesis turns on — variant, karma, and the ledger tallies.
    await page.evaluate(
      save => window.__VERIFY__!.save(save),
      resolvedSlice("free", carriedGrist)
    );
    const freeRun = await page.evaluate(() => window.__VERIFY__!.runState());
    await page.evaluate(
      save => window.__VERIFY__!.save(save),
      resolvedSlice("wield", carriedGrist)
    );
    const wieldRun = await page.evaluate(() => window.__VERIFY__!.runState());
    expect(freeRun?.choice.variant).toBe("free");
    expect(wieldRun?.choice.variant).toBe("wield");
    expect(freeRun?.moralLedger.karma).toBeGreaterThan(0);
    expect(wieldRun?.moralLedger.karma).toBeLessThan(0);
    expect(freeRun?.moralLedger).not.toEqual(wieldRun?.moralLedger);

    // UAT 7 — grow: open the bench funded, equip the shard (begins Cinder
    // learning), and spend grist on a stat (Runner's Reflex, −25, +2 SPD). The
    // earn→spend economy loop closes here on the live canvas.
    await page.goto(`/?scene=bench&uat=1&grist=100`);
    await waitForScene(page, "Bench");
    await waitForSliceBridge(page);
    const benchBefore = await page.evaluate(
      () => window.__VERIFY__?.bench() ?? null
    );
    expect(benchBefore?.shardEquipped).toBe(false);
    await page.evaluate(() => window.__VERIFY__?.equipShard());
    await page.evaluate(() => window.__VERIFY__?.buyRunnersReflex());
    const benchAfter = await page.evaluate(
      () => window.__VERIFY__?.bench() ?? null
    );
    // Equipping the shard began Cinder learning; the stat-spend drew the wallet
    // down by exactly the cost and grew the build (+2 SPD).
    expect(benchAfter?.shardEquipped).toBe(true);
    expect(benchAfter?.cinderLearning).toBe(true);
    expect(benchAfter?.grist).toBe(
      (benchBefore?.grist ?? 0) - RUNNERS_REFLEX_COST
    );
    expect(benchAfter?.spdBonus).toBe(2);

    // UAT 8-9 — save/reload: persist the resolved slice-in-progress, fully reload
    // the page (a real document + a fresh SaveService reading the same IndexedDB),
    // and assert the run is restored EXACTLY — the loop is resumable, closing the
    // one-sitting journey. [EVIDENCE: uats-1-9-pass]
    const snapshot = resolvedSlice("wield", carriedGrist);
    await page.goto("/?scene=battle&uat=1");
    await waitForSliceBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());
    const saved = await page.evaluate(
      save => window.__VERIFY__!.save(save),
      snapshot
    );
    expect(saved).toBe(true);

    await page.goto("/?scene=battle&uat=1");
    await waitForSliceBridge(page);
    const restored = await page.evaluate(() => window.__VERIFY__!.loadSave());
    expect(restored).toEqual(snapshot);

    // The whole nine-step play-through produced no console or page errors.
    expect(errors).toEqual([]);
  });

  test("[determinism-hash-stable] the same seed + action sequence yields an identical state-hash progression, a different seed diverges (AC9)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await page.goto("/?scene=battle&uat=1");
    await waitForScene(page, "Battle");
    await waitForSliceBridge(page);

    const first = await hashProgression(page, DETERMINISM_SEED_A);
    const replay = await hashProgression(page, DETERMINISM_SEED_A);
    const other = await hashProgression(page, DETERMINISM_SEED_B);

    // Same seed + same action sequence ⇒ identical hash progression, and it is a
    // real multi-step run that reached Victory (not a no-op pass).
    expect(replay.hashes).toEqual(first.hashes);
    expect(first.finalPhase).toBe("won");
    expect(new Set(first.hashes).size).toBeGreaterThan(1);
    // A different seed threads a different RNG stream ⇒ a different progression.
    expect(other.hashes).not.toEqual(first.hashes);

    // The slice gate pins to the SAME committed fixtures the headless `hashState`
    // twin in tests/logic and the play-to-victory spec assert against — so the
    // browser lane and the unit lane agree on one fact, not merely with each other.
    // [EVIDENCE: determinism-hash-stable]
    expect(first.hashes).toEqual([...DETERMINISM_HASHES_SEED_A]);
    expect(other.hashes).toEqual([...DETERMINISM_HASHES_SEED_B]);

    expect(errors).toEqual([]);
  });
});
