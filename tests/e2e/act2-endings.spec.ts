/**
 * Act II endings verification (UAT) suite — the Validation Journey for #142 (PRD #43;
 * `wiki/narrative/story.md` "Endings"; `main-quest.md` Ch.9-10). Drives the in-game
 * `window.__VERIFY__` bridge against the live build to prove the issue's acceptance
 * scenario EMPIRICALLY (unit / typecheck / lint alone are NOT acceptable per the
 * issue's Validation Journey):
 *
 * - [EVIDENCE: ending-path-gated-by-standing] — loading two accumulated-standing
 *   profiles makes the reachable ending set DIFFER by standing: an above-threshold
 *   path (the Third Way / Let It Die) is offered for a merciful, fully-gathered run and
 *   gated out for a lone, neutral one, observed scene-agnostically via
 *   `__VERIFY__.openEndings()` / `endings()`; the determinism digest (`endings().hash`)
 *   is identical across two identical loads and differs across the two profiles.
 * - [EVIDENCE: finale-aurel-heart-reachable] — driving to the finale confirms Aurel's
 *   heart is reachable, Sallow is confronted, and the Choir's-Song-whole finale is
 *   entered, and committing a reachable ending records it — via `__VERIFY__.endings()`
 *   / `chooseEnding()`.
 *
 * The bridge is enabled with `?uat=1`; the endings resolve off the pure
 * `logic/narrative/endings` + `logic/narrative/finale` kit, so the active scene is
 * irrelevant and the default boot is used (mirrors `act2-reunion.spec.ts` /
 * `world-state.spec.ts`). The Phaser-free unit twins (`tests/logic/endings.test.ts`,
 * `tests/uat/endings-cell.test.ts`) prove the rules headlessly; this spec proves them
 * on the live canvas.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;

/** The endings snapshot the bridge exposes via `endings()`. */
interface Endings {
  readonly standing: {
    readonly worldState: string;
    readonly karma: number;
    readonly reunionsCompleted: number;
  };
  readonly reachableEndings: readonly string[];
  readonly atAurelsHeart: boolean;
  readonly sallowConfronted: boolean;
  readonly choirSongWhole: boolean;
  readonly chosenEnding: string | null;
  readonly hash: string;
}

/**
 * Wait until the verification bridge is installed with its endings contract. Asserting
 * the whole shape up front means a broken bridge fails here, loudly, instead of silently
 * no-op'ing through an optional chain.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__VERIFY__;
          return (
            typeof api?.openEndings === "function" &&
            typeof api?.chooseEnding === "function" &&
            typeof api?.endings === "function"
          );
        }),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Boot the app with the verification bridge enabled (scene-agnostic — the endings
 * resolve off the content tables + logic kit, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?uat=1");
  await waitForBridge(page);
}

/**
 * Read the endings snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The `endings()` snapshot.
 */
async function endings(page: Page): Promise<Endings> {
  return page.evaluate(() => window.__VERIFY__!.endings() as Endings);
}

test.describe("GRIST — Act II endings gated by standing + finale (UAT, #142)", () => {
  test.beforeEach(async ({ page }) => {
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[EVIDENCE: ending-path-gated-by-standing] the reachable ending set differs by accumulated standing", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));

    // A lone, neutral run: only the always-available damning default (sunder) is reachable.
    const aloneHash = await page.evaluate(() => {
      const api = window.__VERIFY__!;
      api.openEndings({});
      return api.endings().hash;
    });
    const alone = await endings(page);
    expect(alone.reachableEndings).toEqual(["sunder"]);
    // The above-threshold "third way" path is gated OUT for the lone run.
    expect(alone.reachableEndings).not.toContain("third-way");
    expect(alone.reachableEndings).not.toContain("let-die");

    // A merciful, fully-gathered run: the higher ending paths unlock (gated by standing).
    await page.evaluate(() => {
      window.__VERIFY__!.openEndings({
        karma: 3,
        freeChoices: 3,
        wieldChoices: 0,
        reunionsCompleted: 3,
      });
    });
    const gathered = await endings(page);
    // An above-threshold path is offered...
    expect(gathered.reachableEndings).toContain("third-way");
    expect(gathered.reachableEndings).toContain("let-die");
    // ...and strictly more ends are reachable than for the lone run.
    expect(gathered.reachableEndings.length).toBeGreaterThan(
      alone.reachableEndings.length
    );

    // Determinism: the same profile reproduces an identical digest; the two profiles differ.
    const aloneHashAgain = await page.evaluate(() => {
      const api = window.__VERIFY__!;
      api.openEndings({});
      return api.endings().hash;
    });
    expect(aloneHashAgain).toBe(aloneHash);
    expect(gathered.hash).not.toBe(alone.hash);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: finale-aurel-heart-reachable] Aurel's heart is reached, Sallow confronted, the Choir's Song heard whole, and an ending committed", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));

    // Load a Third-Way-eligible run and drive to the finale at Aurel's heart.
    const committedHash = await page.evaluate(() => {
      const api = window.__VERIFY__!;
      api.openEndings({ karma: 2, freeChoices: 2, reunionsCompleted: 2 });
      api.chooseEnding("third-way");
      return api.endings().hash;
    });

    const finale = await endings(page);
    // The finale set-piece is entered: Aurel's heart, Sallow, the Choir's Song heard whole.
    expect(finale.atAurelsHeart).toBe(true);
    expect(finale.sallowConfronted).toBe(true);
    expect(finale.choirSongWhole).toBe(true);
    // The reachable ending-choice is offered and the chosen (reachable) ending committed.
    expect(finale.reachableEndings).toContain("third-way");
    expect(finale.chosenEnding).toBe("third-way");
    expect(finale.hash).toMatch(/^[0-9a-f]{8}$/);

    // Determinism: the same standing + the same choice reproduce an identical digest.
    const secondHash = await page.evaluate(() => {
      const api = window.__VERIFY__!;
      api.openEndings({ karma: 2, freeChoices: 2, reunionsCompleted: 2 });
      api.chooseEnding("third-way");
      return api.endings().hash;
    });
    expect(secondHash).toBe(committedHash);

    // A finale never offers zero paths: even a corrupt run reaches the heart with the
    // damning default in hand.
    await page.evaluate(() => {
      window.__VERIFY__!.openEndings({ karma: -5, wieldChoices: 5 });
    });
    const corrupt = await endings(page);
    expect(corrupt.atAurelsHeart).toBe(true);
    expect(corrupt.reachableEndings).toEqual(["sunder"]);

    expect(errors).toEqual([]);
  });
});
