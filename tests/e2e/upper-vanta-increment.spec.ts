/**
 * Upper Vanta — the Crown & the Tiers **increment-level** verification (UAT) suite —
 * the end-to-end gate for #128 (a `type:Sub-task` under Story #121, the FIRST of the
 * serial Act I regions and the one that carries the Ch.5 keystone the others depend
 * on). Drives the in-game `window.__VERIFY__` bridge against the LIVE built game to
 * prove the increment integrates EMPIRICALLY — not merely compiled (the issue's
 * Validation Journey: "Unit tests / lint / typecheck ALONE are NOT acceptable
 * evidence"). It pins a fixed seed and asserts the issue's two binding evidence
 * markers:
 *
 * - [EVIDENCE: upper-vanta-plays-both-states] — the region loads with its identity,
 *   key locations, and per-region encounters, and plays end-to-end in the *Reach*
 *   world-state AND again in the *Ashfall* world-state, reading observably
 *   differently across the Reckoning (different variant name + encounter set + a
 *   deterministic hash that diverges), with ZERO console errors, and reproducibly
 *   across a genuine page reload. Driven through the rendered Region scene at
 *   `?scene=region&region=upper-vanta` (and `&world=ashfall`) — the same harness the
 *   framework #137 ships, routed to upper Vanta with no engine-code edit.
 * - [EVIDENCE: mourne-ch5-keystone-reachable] — inside upper Vanta, the Ch.5 keystone
 *   at House Mourne's refinery-spire is REACHABLE and RESOLVES: playing it runs the
 *   climax beat to completion and Mr. Sallow TRIGGERS THE RECKONING, observed via
 *   `__VERIFY__.openKeystone("upper-vanta")` / `playKeystoneToCompletion()` /
 *   `keystone()`; and when the spire is un-reached the keystone is SOFT-GATED (neither
 *   plays nor errors). Determinism: the beat's hash progression reproduces across a
 *   genuine reload.
 *
 * The bridge is enabled with `?uat=1`; the keystone rides the content tables + the
 * pure `logic/region` kit, so the active scene is irrelevant for that lane (mirrors
 * `requiem-hall.spec.ts`), while the both-states lane boots the rendered Region scene
 * (mirrors `roots-region.spec.ts`). The Phaser-free unit twins
 * (`tests/logic/upper-vanta-region.test.ts`, `tests/logic/keystone.test.ts`) prove the
 * rules headlessly; this spec proves they integrate on the live, rendered canvas
 * across a real document boundary.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** The fixed increment seed. */
const FIXED_SEED = 0x51ed;
/** Upper Vanta — the increment under verification. */
const VANTA = "upper-vanta";

/** The booted-region-scene snapshot the harness bridge exposes via `regionRun()`. */
interface RegionRun {
  readonly scene: string;
  readonly runtimeScene: string;
  readonly regionId: string;
  readonly worldState: string;
  readonly backdrop: string;
  readonly cursor: number;
  readonly cleared: readonly string[];
  readonly phase: string;
  readonly booted: boolean;
  readonly error: string | null;
  readonly hash: string;
}

/** The keystone snapshot the bridge exposes via `keystone()`. */
interface Keystone {
  readonly regionId: string;
  readonly locationName: string;
  readonly worldState: string;
  readonly reachable: boolean;
  readonly beat: number;
  readonly phase: string;
  readonly triggersReckoning: boolean;
  readonly complete: boolean;
  readonly hash: string;
}

/**
 * Wait until the running game reports the given scene key — proof the requested scene
 * actually booted (not merely that the bridge installed).
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
 * Boot the Region scene directly at upper Vanta with the bridge enabled. `?region=
 * upper-vanta` routes the pure `src/logic/region` harness to upper Vanta with no
 * engine-code edit; `?world=ashfall` (optional) boots straight into the Act II
 * variant; `?seed=` pins the seeded RNG so the run is reproducible.
 * @param page - The Playwright page.
 * @param world - The `?world=` selector (omitted for the default `reach`).
 * @param seed - The fixed boot seed (defaults to {@link FIXED_SEED}).
 */
async function bootVanta(
  page: Page,
  world?: "ashfall",
  seed: number = FIXED_SEED
): Promise<void> {
  const worldQuery = world ? `&world=${world}` : "";
  await page.goto(
    `/?scene=region&uat=1&seed=${seed}&region=${VANTA}${worldQuery}`
  );
  await waitForScene(page, "Region");
}

/**
 * Read the booted region-scene snapshot from the harness bridge.
 * @param page - The Playwright page.
 * @returns The `regionRun()` snapshot, or null outside the Region scene.
 */
async function regionRun(page: Page): Promise<RegionRun | null> {
  return page.evaluate(
    () => (window.__VERIFY__?.regionRun() ?? null) as RegionRun | null
  );
}

/**
 * Drive the region harness to completion, sampling the determinism hash at boot and
 * after each `advance` until the run reports `complete`.
 * @param page - The Playwright page.
 * @returns The hash sampled at boot and after each advance.
 */
async function playRegionToComplete(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const api = window.__VERIFY__!;
    const hashes = [api.hash() ?? ""];
    for (let guard = 0; guard < 32; guard++) {
      const run = api.regionRun();
      if (run === null || run.phase === "complete") {
        break;
      }
      api.act({ kind: "advance" });
      hashes.push(api.hash() ?? "");
    }
    return hashes;
  });
}

/**
 * Wait until the verification bridge is installed with its keystone contract. Asserting
 * the whole shape up front means a broken bridge fails here, loudly, instead of
 * silently no-op'ing through an optional chain.
 * @param page - The Playwright page.
 */
async function waitForKeystoneBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__VERIFY__;
          return (
            typeof api?.openKeystone === "function" &&
            typeof api?.playKeystone === "function" &&
            typeof api?.playKeystoneToCompletion === "function" &&
            typeof api?.keystone === "function"
          );
        }),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Read the keystone snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The `keystone()` snapshot, or null before it is opened.
 */
async function keystone(page: Page): Promise<Keystone | null> {
  return page.evaluate(
    () => (window.__VERIFY__?.keystone() ?? null) as Keystone | null
  );
}

test.describe("GRIST — upper Vanta increment verification (UAT, #128)", () => {
  test("[EVIDENCE: upper-vanta-plays-both-states] the Crown & Tiers load and play end-to-end in BOTH world-states, observably different across the Reckoning, deterministically across a reload, with zero console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    // ── Reach (Act I) ─────────────────────────────────────────────────────────
    await bootVanta(page);
    const reachBoot = await regionRun(page);
    expect(reachBoot).not.toBeNull();
    expect(reachBoot!.regionId).toBe(VANTA);
    expect(reachBoot!.runtimeScene).toBe("region:upper-vanta");
    expect(reachBoot!.worldState).toBe("reach");
    expect(reachBoot!.booted).toBe(true);
    expect(reachBoot!.error).toBeNull();

    const reachHashes = await playRegionToComplete(page);
    const reachDone = await regionRun(page);
    expect(reachDone!.phase).toBe("complete");
    expect(reachDone!.cleared.length).toBeGreaterThan(0);
    expect(reachHashes.every(hash => /^[0-9a-f]{8}$/.test(hash))).toBe(true);

    // ── Ashfall (Act II) ──────────────────────────────────────────────────────
    await bootVanta(page, "ashfall");
    const ashBoot = await regionRun(page);
    expect(ashBoot!.worldState).toBe("ashfall");
    expect(ashBoot!.booted).toBe(true);
    expect(ashBoot!.error).toBeNull();
    // Observably different across the Reckoning: the Ashfall boot digest differs from
    // the Reach boot digest (different variant + encounter set).
    expect(ashBoot!.hash).not.toBe(reachBoot!.hash);

    const ashHashes = await playRegionToComplete(page);
    const ashDone = await regionRun(page);
    expect(ashDone!.phase).toBe("complete");
    // The two states play a different encounter set, so the completed digests diverge.
    expect(ashDone!.hash).not.toBe(reachDone!.hash);

    // Determinism: a GENUINE full reload + same seed reproduces the Reach progression
    // byte-for-byte.
    await bootVanta(page);
    const reachHashesAgain = await playRegionToComplete(page);
    expect(reachHashesAgain).toEqual(reachHashes);

    // …and the same reload-determinism holds for the Ashfall (Act II) variant, so
    // BOTH world-states are proven reproducible across a genuine document boundary
    // (not just Reach).
    await bootVanta(page, "ashfall");
    const ashHashesAgain = await playRegionToComplete(page);
    expect(ashHashesAgain).toEqual(ashHashes);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: mourne-ch5-keystone-reachable] the Ch.5 Mourne keystone is reachable and resolves — Sallow triggers the Reckoning — and is soft-gated when the spire is un-reached, with zero console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await page.goto("/?uat=1");
    await waitForKeystoneBridge(page);

    // Before opening: no keystone is held — the cell cannot fabricate one.
    expect(await page.evaluate(() => window.__VERIFY__!.keystone())).toBeNull();

    // ── Reachable + resolves ──────────────────────────────────────────────────
    // Reach the Mourne refinery-spire (the Ch.5 prerequisite met).
    await page.evaluate(() => window.__VERIFY__!.openKeystone("upper-vanta"));
    const opened = await keystone(page);
    expect(opened).not.toBeNull();
    expect(opened!.regionId).toBe(VANTA);
    expect(opened!.reachable).toBe(true);
    expect(opened!.phase).toBe("sealed");
    expect(opened!.complete).toBe(false);
    expect(opened!.triggersReckoning).toBe(false);
    expect(opened!.locationName).toContain("Refinery-Spire");

    // Play the climax to completion — Sallow triggers the Reckoning.
    await page.evaluate(() => window.__VERIFY__!.playKeystoneToCompletion());
    const played = await keystone(page);
    expect(played!.complete).toBe(true);
    expect(played!.phase).toBe("complete");
    expect(played!.triggersReckoning).toBe(true);
    expect(played!.beat).toBeGreaterThan(0);

    // Determinism: sample the hash progression across a fixed step sequence.
    const sample = async (): Promise<string[]> =>
      page.evaluate(() => {
        const api = window.__VERIFY__!;
        api.openKeystone("upper-vanta");
        const hashes = [api.keystone()!.hash];
        for (let i = 0; i < 4; i++) {
          api.playKeystone();
          hashes.push(api.keystone()!.hash);
        }
        return hashes;
      });
    const firstHashes = await sample();
    expect(firstHashes.every(hash => /^[0-9a-f]{8}$/.test(hash))).toBe(true);
    expect(new Set(firstHashes).size).toBeGreaterThan(1);

    // A GENUINE full reload + same sequence reproduces a byte-identical progression.
    await page.goto("/?uat=1");
    await waitForKeystoneBridge(page);
    const secondHashes = await sample();
    expect(secondHashes).toEqual(firstHashes);

    // ── Soft-gated when the spire is un-reached ───────────────────────────────
    await page.evaluate(() =>
      window.__VERIFY__!.openKeystone("upper-vanta", { reached: false })
    );
    const gated = await keystone(page);
    expect(gated!.reachable).toBe(false);
    expect(gated!.phase).toBe("gated");
    expect(gated!.beat).toBe(0);
    expect(gated!.triggersReckoning).toBe(false);

    // Attempting to play the gated keystone is a no-op — it does not advance or error.
    await page.evaluate(() => {
      window.__VERIFY__!.playKeystone();
      window.__VERIFY__!.playKeystoneToCompletion();
    });
    const afterPlay = await keystone(page);
    expect(afterPlay!.reachable).toBe(false);
    expect(afterPlay!.phase).toBe("gated");
    expect(afterPlay!.beat).toBe(0);
    expect(afterPlay!.triggersReckoning).toBe(false);

    // The gated and reachable keystones are observably distinct (different digest).
    const reachableHash = await page.evaluate(() => {
      window.__VERIFY__!.openKeystone("upper-vanta");
      return window.__VERIFY__!.keystone()!.hash;
    });
    expect(afterPlay!.hash).not.toBe(reachableHash);

    expect(errors).toEqual([]);
  });
});
