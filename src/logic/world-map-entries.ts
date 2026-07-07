/**
 * The pure **World Map entry list** (#241) — the ordered, navigable list of selectable
 * entries the World Map scene renders, derived from the surface projection
 * (`logic/world-map/surface`). Regions come first (catalog order), then the Act-specific
 * nodes: the Reckoning hook in Act I, and the reunion frontier + finale entry in Act II.
 * Kept pure (label / detail / focus-id are total functions of an entry, no Phaser, no
 * color) so the list is unit-testable headless; the scene maps a status to a tint and
 * dispatches the select action.
 * @module logic/world-map-entries
 */
import {
  RegionStatuses,
  type FinaleEntry,
  type ReckoningHook,
  type ReunionNode,
  type WorldMapRegionNode,
  type WorldMapSurface,
} from "./world-map";

/** One selectable World Map entry — a region row or an Act-specific node. */
export type WorldMapEntry =
  | { readonly kind: "region"; readonly node: WorldMapRegionNode }
  | { readonly kind: "reckoning"; readonly hook: ReckoningHook }
  | { readonly kind: "reunion"; readonly node: ReunionNode }
  | { readonly kind: "finale"; readonly finale: FinaleEntry };

/** The player-facing status label for a region grade. */
const STATUS_LABEL: Readonly<Record<string, string>> = {
  [RegionStatuses.locked]: "LOCKED",
  [RegionStatuses.available]: "AVAILABLE",
  [RegionStatuses.inProgress]: "IN PROGRESS",
  [RegionStatuses.complete]: "COMPLETE",
};

/**
 * Build the ordered selectable-entry list from a surface: every region, then the Act I
 * Reckoning hook (when present) or the Act II reunion frontier + finale entry. Pure.
 * @param surface - The projected world-map surface.
 * @returns The ordered entry list.
 */
export function buildWorldMapEntries(
  surface: WorldMapSurface
): readonly WorldMapEntry[] {
  const regions: readonly WorldMapEntry[] = surface.regions.map(node => ({
    kind: "region",
    node,
  }));
  const reckoning: readonly WorldMapEntry[] =
    surface.reckoning === null
      ? []
      : [{ kind: "reckoning", hook: surface.reckoning }];
  const reunions: readonly WorldMapEntry[] = surface.reunions.map(node => ({
    kind: "reunion",
    node,
  }));
  const finale: readonly WorldMapEntry[] = surface.reunions.length
    ? [{ kind: "finale", finale: surface.finale }]
    : surface.finale.available
      ? [{ kind: "finale", finale: surface.finale }]
      : [];
  return [...regions, ...reckoning, ...reunions, ...finale];
}

/**
 * The stable id of an entry (a region id, a node key, or a reunion id) — the value the
 * bridge reports as `focusId`. Pure.
 * @param entry - The entry to identify.
 * @returns The entry's stable id.
 */
export function worldMapEntryId(entry: WorldMapEntry): string {
  switch (entry.kind) {
    case "region":
      return entry.node.id;
    case "reckoning":
      return "reckoning";
    case "reunion":
      return entry.node.id;
    case "finale":
      return "finale";
  }
}

/**
 * The one-line row label for an entry: the region name + its status (and a "here"
 * marker on the current location), or a labelled Act node. Pure.
 * @param entry - The entry to label.
 * @returns The row label text.
 */
export function worldMapEntryLabel(entry: WorldMapEntry): string {
  switch (entry.kind) {
    case "region": {
      const status = STATUS_LABEL[entry.node.status] ?? entry.node.status;
      return `${entry.node.name} — ${status}${entry.node.current ? "  ◂ here" : ""}`;
    }
    case "reckoning":
      return `⚑ The Reckoning${entry.hook.available ? "" : "  (sealed)"}`;
    case "reunion":
      return `↺ ${entry.node.name}`;
    case "finale":
      return `★ Aurel's Heart${entry.finale.available ? "" : "  (sealed)"}`;
  }
}

/**
 * The detail/cue line for the focused entry: a region's unlock cue (locked) or cleared
 * count, a hook's label, a reunion's environmental hook, or the finale's read. Pure.
 * @param entry - The focused entry.
 * @returns The detail line text.
 */
export function worldMapEntryDetail(entry: WorldMapEntry): string {
  switch (entry.kind) {
    case "region":
      return entry.node.status === RegionStatuses.locked
        ? entry.node.cue
        : `${entry.node.name} · ${entry.node.cleared}/${entry.node.total} encounters cleared`;
    case "reckoning":
      return entry.hook.label;
    case "reunion":
      return entry.node.hook;
    case "finale":
      return entry.finale.available
        ? "The way to Aurel's heart is open — the finale awaits."
        : "Sealed until the Reckoning turns the world.";
  }
}
