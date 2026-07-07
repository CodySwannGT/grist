/**
 * The pause-menu **Party** panel view (#249) — a thin Phaser adapter that pools a row
 * per roster member (a small portrait faceset beside a compact stat line) plus the
 * roster-wide bench-build lines, and renders the pure {@link projectPartyRoster}
 * projection into them, the way {@link import("./help-panel").HelpPanel} and the
 * {@link import("./ledger-codex-panel").LedgerCodexPanel} render their models. Extracted
 * from the {@link import("../scenes/Menu").Menu} scene so the scene stays under its line
 * budget and the roster's Phaser plumbing lives next to the pure copy it renders
 * (`ui/party-roster` for the wording, `logic/party-roster` for the model).
 *
 * It owns NO roster rules — the order, the fallback-to-starting-party, the stat/shard
 * resolution, and the wording all come from the pure projection/formatter; this only
 * lays the resulting rows out (a faceset for the named cast, a graceful empty slot for
 * members without one) and holds the projected {@link PartyRosterView} for the
 * verification bridge to read, so an e2e can prove the panel showed the real roster
 * (names + HP/AP) without inspecting pixels.
 * @module ui/party-panel
 */
import Phaser from "phaser";
import { AtlasKeys, Frames } from "../assets";
import { MenuTextStyles, PartyLayout } from "../menu-consts";
import { PartyMemberIds, type PartyMemberId } from "../content/party";
import {
  type PartyMemberView,
  type PartyRosterView,
} from "../logic/party-roster";
import { partyBuildLines, partyMemberLine } from "./party-roster";
import { partyLineWrapWidth } from "./menu-panel-fit";

/**
 * The portrait atlas faceset each member's row shows. Only the named cast the
 * `portraits` atlas covers (Wren, Tobi, Halcyon) has a faceset; a member without one
 * (the reunion companions) renders a graceful empty slot rather than a wrong face.
 */
const MEMBER_FACESETS: Partial<Record<PartyMemberId, string>> = {
  [PartyMemberIds.wren]: Frames.portraits.wren,
  [PartyMemberIds.tobi]: Frames.portraits.tobi,
  [PartyMemberIds.halcyon]: Frames.portraits.halcyon,
};

/** The pooled game objects for one member row (its portrait faceset + stat line). */
interface MemberRow {
  readonly portrait: Phaser.GameObjects.Image;
  readonly line: Phaser.GameObjects.Text;
}

/**
 * Pools the roster rows + bench-build lines and renders a projected roster into them.
 * Built once with the scene; `show()` fills it from a {@link PartyRosterView}, `hide()`
 * clears it, and `roster()` returns what is currently shown (null while hidden) — the
 * model the verification bridge surfaces as `menuParty()`.
 */
export class PartyPanel {
  /** The pooled member rows (portrait + stat line), one per `memberSlots`. */
  readonly #rows: readonly MemberRow[];
  /** The pooled bench-build lines stacked below the roster. */
  readonly #buildLines: readonly Phaser.GameObjects.Text[];
  /** The roster currently shown, or null while hidden. */
  #roster: PartyRosterView | null = null;

  /**
   * Build the pooled member rows and bench-build lines under the detail panel, laid
   * out from {@link PartyLayout}. Hidden until {@link show}.
   * @param scene - The owning scene.
   * @param x - The left x of the panel body (the panel's padded inset).
   */
  constructor(scene: Phaser.Scene, x: number) {
    const lineX = x + PartyLayout.portraitSize + PartyLayout.lineInset;
    this.#rows = Array.from(
      { length: PartyLayout.memberSlots },
      (_unused, row) => this.#buildRow(scene, x, lineX, row)
    );
    const buildY =
      PartyLayout.rowY + PartyLayout.memberSlots * PartyLayout.rowGap;
    this.#buildLines = Array.from(
      { length: PartyLayout.buildLineSlots },
      (_unused, line) =>
        scene.add
          .text(
            x,
            buildY + line * PartyLayout.buildLineGap,
            "",
            MenuTextStyles.partyBuild
          )
          .setVisible(false)
    );
  }

  /**
   * Build one pooled member row: a portrait faceset (hidden until a member with a
   * faceset fills it) and its compact stat line.
   * @param scene - The owning scene.
   * @param portraitX - The row's portrait left x.
   * @param lineX - The stat line's left x (right of the portrait).
   * @param row - The zero-based row index (stacks down by `rowGap`).
   * @returns The pooled member row.
   */
  #buildRow(
    scene: Phaser.Scene,
    portraitX: number,
    lineX: number,
    row: number
  ): MemberRow {
    const y = PartyLayout.rowY + row * PartyLayout.rowGap;
    const portrait = scene.add
      .image(
        portraitX + PartyLayout.portraitSize / 2,
        y + PartyLayout.portraitSize / 2,
        AtlasKeys.portraits,
        Frames.portraits.wren
      )
      .setDisplaySize(PartyLayout.portraitSize, PartyLayout.portraitSize)
      .setVisible(false);
    const line = scene.add
      .text(lineX, y, "", {
        ...MenuTextStyles.partyMember,
        wordWrap: { width: partyLineWrapWidth() },
      })
      .setVisible(false);
    return { portrait, line };
  }

  /**
   * Show the projected roster: render each member's portrait (a faceset for the named
   * cast, a graceful empty slot otherwise) and compact stat line, then the roster-wide
   * bench-build lines. Members beyond the pooled rows are dropped (the pool spans the
   * full authored roster); unused rows and build lines are cleared and hidden.
   * @param roster - The projected roster view.
   * @returns void
   */
  show(roster: PartyRosterView): void {
    this.#roster = roster;
    this.#rows.forEach((slot, index) => {
      const member = roster.members[index];
      if (member === undefined) {
        slot.portrait.setVisible(false);
        slot.line.setVisible(false).setText("");
        return;
      }
      this.#renderPortrait(slot.portrait, member);
      slot.line.setVisible(true).setText(partyMemberLine(member));
    });
    const lines = partyBuildLines(roster.build);
    this.#buildLines.forEach((slot, index) => {
      const text = lines[index] ?? "";
      slot.setVisible(text !== "").setText(text);
    });
  }

  /**
   * The right-edge x of the widest visible party line — a member stat line or a
   * bench-build line, its left x plus its rendered (wrapped) width — or null while the
   * panel is hidden. The verification bridge reads this against the panel's inner right
   * bound so an e2e can prove no party row clips the panel's right border (#265).
   * @returns The widest line's right edge, or null when hidden.
   */
  maxLineRight(): number | null {
    if (this.#roster === null) {
      return null;
    }
    const texts = [
      ...this.#rows.map(row => row.line),
      ...this.#buildLines,
    ].filter(line => line.visible);
    return texts.reduce((max, line) => Math.max(max, line.x + line.width), 0);
  }

  /**
   * Point a row's portrait at the member's faceset, revealing it for the named cast and
   * hiding it (a graceful empty slot) for a member without one.
   * @param portrait - The pooled portrait image.
   * @param member - The member the row renders.
   * @returns void
   */
  #renderPortrait(
    portrait: Phaser.GameObjects.Image,
    member: PartyMemberView
  ): void {
    const faceset = MEMBER_FACESETS[member.id];
    if (faceset === undefined) {
      portrait.setVisible(false);
      return;
    }
    portrait
      .setTexture(AtlasKeys.portraits, faceset)
      .setDisplaySize(PartyLayout.portraitSize, PartyLayout.portraitSize)
      .setVisible(true);
  }

  /**
   * Hide every member row and bench-build line and forget the shown roster (so the
   * bridge read goes null when the panel closes).
   * @returns void
   */
  hide(): void {
    this.#roster = null;
    this.#rows.forEach(slot => {
      slot.portrait.setVisible(false);
      slot.line.setVisible(false).setText("");
    });
    this.#buildLines.forEach(slot => slot.setVisible(false).setText(""));
  }

  /**
   * The roster currently shown, or null while hidden — the model the verification
   * bridge surfaces.
   * @returns The shown roster view, or null.
   */
  roster(): PartyRosterView | null {
    return this.#roster;
  }
}
