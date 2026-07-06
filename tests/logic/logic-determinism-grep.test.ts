/**
 * The determinism source-purity gate (issue #117, Scenario 2 — the grep half).
 *
 * The determinism thesis is "same seed + same input sequence ⇒ identical state
 * hash" (proven behaviorally by `combat-determinism` / `play-to-victory` /
 * `slice-uat`). That only holds if the pure logic core NEVER reaches for a
 * non-deterministic ambient source: `Math.random`, `Date.now`, or
 * `performance.now`. Randomness must come from the seeded stream (`src/logic/rng.ts`)
 * and time must be an injected parameter, never the wall clock. This Phaser-free
 * twin is the executable form of the AC's "a grep confirms no Math.random /
 * Date.now / performance.now in src/logic" — it walks every `.ts` under `src/logic`
 * and fails if any CALLS one of them.
 *
 * It matches *call sites* in executable code, not prose: comments legitimately name
 * these APIs to explain why they are avoided (e.g. `rng.ts` documents that it "never
 * uses Math.random()"), so the file's line and block comments are stripped before
 * the scan. A false positive on a JSDoc mention would be as wrong as missing a real
 * call. Mirrors the existing `src/logic imports no Phaser` walker in
 * `combat-engine.test.ts` — same reused `collectTsFiles` recursion, one purity axis.
 * @module tests/logic/logic-determinism-grep
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/** The non-deterministic ambient sources banned from the pure logic core. */
const BANNED_CALLS = [
  { name: "Math.random", pattern: /\bMath\s*\.\s*random\s*\(/ },
  { name: "Date.now", pattern: /\bDate\s*\.\s*now\s*\(/ },
  { name: "performance.now", pattern: /\bperformance\s*\.\s*now\s*\(/ },
] as const;

/**
 * Strip line and block comments so the scan sees only executable code — a comment
 * that names a banned API (to explain its absence) is not a call.
 * @param source - The raw TypeScript source.
 * @returns The source with its comments removed.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/[^\n]*/gu, "");
}

/**
 * Recursively collect every `.ts` source file under a directory.
 * @param dir - Absolute directory path.
 * @returns Absolute paths of all `.ts` files found.
 */
function collectTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      return collectTsFiles(full);
    }
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

/**
 * The banned call sites found in one file's executable code (comments stripped).
 * @param file - Absolute path to the source file.
 * @returns The `file:api` offenders (empty when the file is pure).
 */
function offendersIn(file: string): string[] {
  const code = stripComments(readFileSync(file, "utf8"));
  return BANNED_CALLS.filter(banned => banned.pattern.test(code)).map(
    banned => `${file}: ${banned.name}`
  );
}

describe("src/logic is deterministic — no ambient Math.random / Date.now / performance.now (#117 Scenario 2)", () => {
  it("no module under src/logic calls a non-deterministic ambient source", () => {
    const root = fileURLToPath(new URL("../../src/logic", import.meta.url));
    const files = collectTsFiles(root);
    // Guard the walker itself: an empty sweep would pass vacuously.
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.flatMap(offendersIn);
    expect(offenders).toEqual([]);
  });

  it("the scan targets call sites, not prose (a JSDoc mention is not an offender)", () => {
    // rng.ts documents that it "never uses Math.random()" — a comment, not a call.
    // Proving the stripper excludes it guards against a false-positive that would
    // make the gate un-actionable.
    const commentOnly =
      "/** never uses Math.random() */\nexport const x = 1;\n";
    const realCall = "export const r = Math.random();\n";
    const scan = (source: string): boolean =>
      BANNED_CALLS.some(banned => banned.pattern.test(stripComments(source)));
    expect(scan(commentOnly)).toBe(false);
    expect(scan(realCall)).toBe(true);
  });
});
