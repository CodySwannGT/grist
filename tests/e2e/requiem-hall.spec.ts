/**
 * Sidhe requiem-hall Chapter 4 set-piece verification (UAT) suite — the Validation
 * Journey for #145 (PRD #43 Scope-IN 4; `wiki/narrative/main-quest.md` Ch.4 — The
 * requiem). Drives the in-game `window.__VERIFY__` bridge against the live build to
 * prove the issue's two acceptance scenarios EMPIRICALLY (unit / typecheck / lint
 * alone are NOT acceptable per the issue's Validation Journey):
 *
 * - [EVIDENCE: requiem-hall-setpiece-plays] (scenario 1) — inside the Roots / the Deep
 *   with the Ch.4 prerequisites met (the Roots Bound, Velith, attuned), entering the
 *   Sidhe requiem-hall runs the Ch.4 set-piece beat to COMPLETION with ZERO console
 *   errors, observed scene-agnostically via `__VERIFY__.openRequiemHall("roots")` /
 *   `playRequiemHallToCompletion()` / `requiemHall()`. Determinism: the beat's hash
 *   progression is reproducible across a genuine reload (same region + run + seed +
 *   action sequence ⇒ identical digest).
 * - [EVIDENCE: requiem-hall-reachable] (scenario 2) — without the Ch.4 prerequisites
 *   (`{ withVelith: false }`), the requiem-hall is SOFT-GATED (not reachable): playing
 *   it neither advances the beat nor raises a console / page error.
 *
 * The bridge is enabled with `?uat=1`; the set-piece rides the content tables + the
 * pure `logic/region` kit, so the active scene is irrelevant and the default boot is
 * used (mirrors `velith-bound-site.spec.ts` / `roots-region.spec.ts`). The Phaser-free
 * unit twin (`tests/logic/requiem-hall.test.ts`) proves the rules headlessly; this
 * spec proves them on the live, rendered canvas across a real document boundary.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** The Roots / the Deep region — the one that hosts the Sidhe requiem-hall. */
const ROOTS = "roots";

/** The requiem-hall snapshot the bridge exposes via `requiemHall()`. */
interface RequiemHall {
  readonly regionId: string;
  readonly locationName: string;
  readonly worldState: string;
  readonly reachable: boolean;
  readonly beat: number;
  readonly phase: string;
  readonly complete: boolean;
  readonly hash: string;
}

/**
 * Wait until the verification bridge is installed with its requiem-hall contract
 * (`openRequiemHall` / `playRequiemHall` / `playRequiemHallToCompletion` /
 * `requiemHall`). Asserting the whole shape up front means a broken bridge fails here,
 * loudly, instead of silently no-op'ing through an optional chain.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__VERIFY__;
          return (
            typeof api?.openRequiemHall === "function" &&
            typeof api?.playRequiemHall === "function" &&
            typeof api?.playRequiemHallToCompletion === "function" &&
            typeof api?.requiemHall === "function"
          );
        }),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Boot the app with the verification bridge enabled (scene-agnostic — the set-piece
 * rides the content tables + logic kit, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?uat=1");
  await waitForBridge(page);
}

/**
 * Read the requiem-hall snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The `requiemHall()` snapshot, or null before a hall is opened.
 */
async function requiemHall(page: Page): Promise<RequiemHall | null> {
  return page.evaluate(
    () => (window.__VERIFY__?.requiemHall() ?? null) as RequiemHall | null
  );
}

test.describe("GRIST — the Sidhe requiem-hall Ch.4 set-piece (UAT, #145)", () => {
  test.beforeEach(async ({ page }) => {
    await bootWithBridge(page);
  });

  test("[EVIDENCE: requiem-hall-setpiece-plays] with Ch.4 prerequisites met, entering the Sidhe requiem-hall runs its Ch.4 beat to completion with zero console errors, deterministically across a reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    // Before opening: no hall is held — the cell cannot fabricate one.
    expect(
      await page.evaluate(() => window.__VERIFY__!.requiemHall())
    ).toBeNull();

    // Reach the Roots requiem-hall with the Ch.4 prerequisites met (Velith attuned).
    await page.evaluate(() => window.__VERIFY__!.openRequiemHall("roots"));
    const opened = await requiemHall(page);
    expect(opened).not.toBeNull();
    expect(opened!.regionId).toBe(ROOTS);
    // The Ch.4 prerequisites are met → the hall is reachable and starts sealed.
    expect(opened!.reachable).toBe(true);
    expect(opened!.phase).toBe("sealed");
    expect(opened!.complete).toBe(false);
    expect(opened!.locationName).toContain("Requiem-Hall");

    // Play the set-piece beat to completion — the Ch.4 beat runs to its end.
    await page.evaluate(() => window.__VERIFY__!.playRequiemHallToCompletion());
    const played = await requiemHall(page);
    expect(played!.complete).toBe(true);
    expect(played!.phase).toBe("complete");
    expect(played!.beat).toBeGreaterThan(0);

    // Sample the determinism hash progression across a fixed step sequence.
    const sample = async (): Promise<string[]> =>
      page.evaluate(() => {
        const api = window.__VERIFY__!;
        api.openRequiemHall("roots");
        const hashes = [api.requiemHall()!.hash];
        for (let i = 0; i < 4; i++) {
          api.playRequiemHall();
          hashes.push(api.requiemHall()!.hash);
        }
        return hashes;
      });
    const firstHashes = await sample();
    expect(firstHashes.every(hash => /^[0-9a-f]{8}$/.test(hash))).toBe(true);
    expect(new Set(firstHashes).size).toBeGreaterThan(1);

    // A GENUINE full reload + same sequence reproduces a byte-identical progression.
    await bootWithBridge(page);
    const secondHashes = await sample();
    expect(secondHashes).toEqual(firstHashes);

    // The whole point of the success path: zero console errors.
    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: requiem-hall-reachable] without the Ch.4 prerequisites the requiem-hall is soft-gated: it neither plays nor errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    // Open the hall WITHOUT meeting the Ch.4 prerequisites (Velith not attuned).
    await page.evaluate(() =>
      window.__VERIFY__!.openRequiemHall("roots", { withVelith: false })
    );
    const gated = await requiemHall(page);
    expect(gated).not.toBeNull();
    expect(gated!.regionId).toBe(ROOTS);
    // Soft-gated: not reachable, and the beat has not played (no progress).
    expect(gated!.reachable).toBe(false);
    expect(gated!.phase).toBe("gated");
    expect(gated!.beat).toBe(0);
    expect(gated!.complete).toBe(false);

    // Attempting to play the gated hall is a no-op — it does not advance or error.
    await page.evaluate(() => {
      window.__VERIFY__!.playRequiemHall();
      window.__VERIFY__!.playRequiemHallToCompletion();
    });
    const afterPlay = await requiemHall(page);
    expect(afterPlay!.reachable).toBe(false);
    expect(afterPlay!.phase).toBe("gated");
    expect(afterPlay!.beat).toBe(0);
    expect(afterPlay!.complete).toBe(false);

    // The gated and reachable halls are observably distinct (different digest), and
    // the soft-gate raised no console / page error.
    const reachableHash = await page.evaluate(() => {
      window.__VERIFY__!.openRequiemHall("roots");
      return window.__VERIFY__!.requiemHall()!.hash;
    });
    expect(afterPlay!.hash).not.toBe(reachableHash);
    expect(errors).toEqual([]);
  });
});
