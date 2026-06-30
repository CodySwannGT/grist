/**
 * The 3-room Marrow map ("The Bound in the Marrow") as a typed TS-module table.
 * Each room carries its display name, its authored props (interactable / set
 * dressing the Field scene will place), and the encounter it triggers. The
 * `encounter` reference is an {@link EncounterId} so a room can only trigger a
 * defined encounter — referencing an undefined id is a compile error. The Field
 * scene that *renders* this map (#71) and the launcher that *runs* the encounter
 * (#72) are out of scope; this is the data they consume. Pure data — no Phaser.
 * @module content/map
 */
import { EncounterIds, type EncounterId } from "./encounters";

/**
 * A placed prop in a room: set dressing or an interactable (e.g. the salvage
 * cache in The Drip). `interactable` marks a prop the player can act on; the
 * Field scene owns the visual + interaction wiring.
 */
export interface MapProp {
  readonly id: string;
  readonly name: string;
  readonly interactable: boolean;
}

/**
 * A room in the Marrow descent: its name, its props, and the encounter its
 * trigger launches. The party walks A → B → C.
 */
export interface MarrowRoomDef {
  readonly id: MarrowRoomId;
  readonly name: string;
  readonly props: readonly MapProp[];
  readonly encounter: EncounterId;
}

/** Canonical room ids (A / B / C of the slice). */
export const MarrowRoomIds = {
  a: "room-a",
  b: "room-b",
  c: "room-c",
} as const;

/** A room id (the literal-union of every defined room key). */
export type MarrowRoomId = (typeof MarrowRoomIds)[keyof typeof MarrowRoomIds];

/**
 * The three connected Marrow spaces: A Warren Street — the runner-warrens (the
 * lone scrapper, with the rendering-notice sign); B The Drip — the
 * rendering-house pass (the scrapper + Vesper render-construct, with the salvage
 * cache and the examinable rendering vat); C The Cage — the descent (the
 * Ashling). The mapped type binds each entry's `id` to its table key, so the key
 * and the `id` can never drift.
 */
export const MARROW_MAP: {
  readonly [K in MarrowRoomId]: MarrowRoomDef & { readonly id: K };
} = {
  "room-a": {
    id: MarrowRoomIds.a,
    name: "Warren Street",
    props: [
      { id: "warren-rubble", name: "Collapsed rubble", interactable: false },
      {
        id: "warren-sign",
        name: 'Faded "Warren St." sign',
        interactable: false,
      },
    ],
    encounter: EncounterIds.warrenStreet,
  },
  "room-b": {
    id: MarrowRoomIds.b,
    name: "The Drip",
    props: [
      { id: "drip-leak", name: "Dripping conduit", interactable: false },
      { id: "drip-salvage-cache", name: "Salvage cache", interactable: true },
      // The rendering-house lore prop (#106): the rendering vat whose
      // examine surfaces "what the city eats" — the Marrow runs on the dead.
      { id: "render-vat", name: "Rendering vat", interactable: true },
    ],
    encounter: EncounterIds.theDrip,
  },
  "room-c": {
    id: MarrowRoomIds.c,
    name: "The Cage",
    props: [
      { id: "cage-bars", name: "Bound-iron bars", interactable: false },
      { id: "cage-altar", name: "The Ashling's altar", interactable: false },
    ],
    encounter: EncounterIds.theCage,
  },
};
