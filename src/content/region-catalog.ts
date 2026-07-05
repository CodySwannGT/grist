/**
 * The region content catalog: the {@link REGIONS} data table extracted from the
 * region schema module (`content/regions`) so the schema/helpers and the growing
 * per-region DATA live in separate files. Each region is authored here as pure
 * data against the {@link RegionDef} template — identity, both world-state variants
 * (the verdant Reach and the ashen Ashfall), per-region encounter tables, and the
 * single {@link BoundId} the region sites — with ZERO Phaser imports (FR9), no I/O,
 * and no RNG. Adding a region is adding an entry here (living docs, decision 0003);
 * the schema, validators, and boot harness never change. Keeping the data in its
 * own module keeps each file focused and under the max-lines cap as the catalog
 * grows region by region across Act I and Act II.
 * @module content/region-catalog
 */
import { BoundIds } from "./bounds";
import { EncounterIds } from "./encounters";
import { RegionIds, type RegionDef, type RegionId } from "./regions";

/**
 * The region table. The mapped type binds each entry's `id` to its table key, so
 * the key and the `id` can never drift — the same idiom `ENEMIES` / `ENCOUNTERS` /
 * `BOUNDS` / `MARROW_MAP` use. The `marrow` region is the canonical example: the
 * Marrow descent authored against the template in both world-states (the verdant
 * Reach and the ashen Ashfall), siting the Marrow Bound shard.
 */
export const REGIONS: {
  readonly [K in RegionId]: RegionDef & { readonly id: K };
} = {
  marrow: {
    id: RegionIds.marrow,
    boundSite: BoundIds.marrowBound,
    states: {
      reach: {
        name: "The Marrow Reach",
        tone: "verdant",
        keyLocations: [
          { id: "warren-street", name: "Warren Street" },
          { id: "the-drip", name: "The Drip" },
        ],
        encounters: [EncounterIds.warrenStreet, EncounterIds.theDrip],
        sideStories: [{ id: "the-salvage-cache", name: "The Salvage Cache" }],
      },
      ashfall: {
        name: "The Marrow Ashfall",
        tone: "ashen",
        keyLocations: [
          { id: "warren-street", name: "Warren Street (ashen)" },
          { id: "the-cage", name: "The Cage" },
        ],
        encounters: [EncounterIds.theDrip, EncounterIds.theCage],
        sideStories: [{ id: "the-salvage-cache", name: "The Hollow Cache" }],
      },
    },
  },
  // The Roots / the Deep (#143): the buried pre-Sundering ruins beneath the corpse
  // — pooled wild Weave, old things lingering, the fantasy heart under the city
  // (wiki/design/regions.md). Sites Velith, the Deep-bound (the ancient near-free
  // power that remembers the Choir). Authored against the shipped template in BOTH
  // world-states: the verdant Reach (a last bright place, the Weave still pooled)
  // and the ashen Ashfall (the Weave guttering but not dead — a less-total decay
  // than other regions, still warped/desaturated). Reach and Ashfall draw DIFFERENT
  // encounter tables so the region reads observably differently across the
  // Reckoning. The Sidhe requiem-hall set-piece itself is #145 (out of scope here);
  // this authors it as a key location only.
  roots: {
    id: RegionIds.roots,
    boundSite: BoundIds.velithDeepbound,
    states: {
      reach: {
        name: "The Roots Reach",
        tone: "verdant",
        keyLocations: [
          { id: "drowned-old-kingdom", name: "The Drowned Old Kingdom" },
          { id: "sidhe-requiem-hall", name: "The Sidhe Requiem-Hall" },
        ],
        encounters: [EncounterIds.drownedKingdom, EncounterIds.requiemHall],
        sideStories: [
          { id: "the-choir-that-remembers", name: "The Choir That Remembers" },
        ],
      },
      ashfall: {
        name: "The Roots Ashfall",
        tone: "ashen",
        keyLocations: [
          {
            id: "drowned-old-kingdom",
            name: "The Drowned Old Kingdom (guttering)",
          },
          {
            id: "sidhe-requiem-hall",
            name: "The Sidhe Requiem-Hall (dimmed)",
          },
        ],
        encounters: [EncounterIds.requiemHall, EncounterIds.deepAudit],
        sideStories: [
          { id: "the-choir-that-remembers", name: "The Choir Gone Quiet" },
        ],
      },
    },
  },
  // Upper Vanta — the Crown + the Tiers (#128), the FIRST of Story #121's serial
  // Act I regions and the one that carries the Ch.5 keystone the others depend on.
  // Authored against the shipped template (framework #119, CLOSED) in BOTH
  // world-states, wiki-authoritative (`wiki/design/regions.md` — Vanta the vertical
  // hub; `wiki/narrative/main-quest.md` — Ch.5 the keystone):
  //   • The Crown — corporate spires on Aurel's skull (Concord Hall; House Mourne's
  //     refinery-spire; the Founding plaza); gold light, cold order.
  //   • The Tiers — the working city (Tobi's workshop; the grand market; Quill
  //     media-halls).
  // Unlike every other Act I region, upper Vanta cages NO Bound — "the Crown
  // consumes, it doesn't hold" (regions.md) — so `boundSite` is omitted and its lone
  // anchor is the Ch.5 keystone at the Mourne refinery-spire (the Act I climax
  // set-piece where Mr. Sallow triggers the Reckoning), modeled in
  // `logic/region/keystone`. Reach and Ashfall draw DIFFERENT encounter tables so
  // the region reads observably differently across the Reckoning: the Reach is gold
  // and orderly, the Ashfall half-collapsed and grey (the Crown bunkered/fled, the
  // Tiers shuttered and scavenger-run). Detailed stat blocks / palettes / dialogue
  // are living docs (decision 0003), out of scope; this authors the region identity,
  // key locations, per-region encounters, side-stories, and both variants.
  "upper-vanta": {
    id: RegionIds.upperVanta,
    // No boundSite — the Crown holds no Bound; the anchor is the Ch.5 keystone.
    states: {
      reach: {
        name: "Upper Vanta — the Crown & the Tiers",
        tone: "verdant",
        keyLocations: [
          { id: "concord-hall", name: "The Concord Hall" },
          {
            id: "mourne-refinery-spire",
            name: "House Mourne's Refinery-Spire",
          },
          { id: "founding-plaza", name: "The Founding Plaza" },
          { id: "tobis-workshop", name: "Tobi's Workshop" },
          { id: "grand-market", name: "The Grand Market" },
          { id: "quill-media-halls", name: "The Quill Media-Halls" },
        ],
        encounters: [EncounterIds.tiersMarket, EncounterIds.crownConcord],
        sideStories: [
          { id: "the-founding-holiday", name: "The Founding Holiday" },
          { id: "tobis-commission", name: "Tobi's Commission" },
        ],
      },
      ashfall: {
        name: "Upper Vanta — the Grey Crown & the Shuttered Tiers",
        tone: "ashen",
        keyLocations: [
          { id: "concord-hall", name: "The Concord Hall (bunkered)" },
          {
            id: "mourne-refinery-spire",
            name: "House Mourne's Refinery-Spire (the keystone struck)",
          },
          { id: "founding-plaza", name: "The Founding Plaza (ash-fallen)" },
          { id: "tobis-workshop", name: "Tobi's Workshop (shuttered)" },
          { id: "grand-market", name: "The Grand Market (scavenger-run)" },
          {
            id: "quill-media-halls",
            name: "The Quill Media-Halls (a few stubborn lights)",
          },
        ],
        encounters: [EncounterIds.crownConcord, EncounterIds.mourneRefinery],
        sideStories: [
          { id: "the-founding-holiday", name: "The Founding, Mourned" },
          { id: "tobis-commission", name: "Tobi's Last Commission" },
        ],
      },
    },
  },
  // The Sylvemarch (#129): the surviving forest, the Green Mother's march — a living
  // Deep place where the Weave still breathes, home to the Sidhe enclave (Maren's
  // people) and the brightest palette in the game (wiki/design/regions.md —
  // Sylvemarch). Sites Sylvath, the Green Wyrm (Bloom), the region's one Bound and a
  // major free-vs-wield decision (a great caged wyrm). Authored against the shipped
  // template in BOTH world-states: the verdant Reach (the brightest, most alive place
  // in Act I) and the ashen Ashfall (the forest greying and dying fast — by design
  // the most painful transformation). Reach and Ashfall draw DIFFERENT encounter
  // tables so the region reads observably differently across the Reckoning: the Reach
  // walks the Sidhe enclave and the Weave-spring; the Ashfall replaces the enclave
  // with the greying march as the living Weave guts out. The Sylvath Bound-site
  // free-vs-wield interaction reuses the shipped Bound-site template (#135) + Phase-2
  // kit (#69); this authors the region identity, key locations, per-region
  // encounters, side-stories, and both variants (stat blocks are living docs, 0003).
  sylvemarch: {
    id: RegionIds.sylvemarch,
    boundSite: BoundIds.sylvath,
    states: {
      reach: {
        name: "The Sylvemarch Reach",
        tone: "verdant",
        keyLocations: [
          { id: "sidhe-enclave", name: "The Sidhe Enclave" },
          { id: "weave-spring", name: "The Weave-Spring" },
          { id: "sundering-ruins", name: "The Overgrown Ruins" },
        ],
        encounters: [EncounterIds.sylvanEnclave, EncounterIds.weaveSpring],
        sideStories: [
          { id: "the-green-mothers-march", name: "The Green Mother's March" },
        ],
      },
      ashfall: {
        name: "The Sylvemarch Ashfall",
        tone: "ashen",
        keyLocations: [
          { id: "sidhe-enclave", name: "The Sidhe Enclave (fled)" },
          { id: "weave-spring", name: "The Weave-Spring (guttering)" },
          { id: "sundering-ruins", name: "The Overgrown Ruins (bared)" },
        ],
        encounters: [EncounterIds.weaveSpring, EncounterIds.greyingMarch],
        sideStories: [
          { id: "the-green-mothers-march", name: "The Green Mother, Mourned" },
        ],
      },
    },
  },
  // Holtspire (#130): the Anvil-city — a rival industrial city-state ruled by House
  // Caldecott, all foundries, frames, and smoke, and Caldecott's resentment of House
  // Mourne (wiki/design/regions.md — Holtspire, the Anvil-city). Sites Korrholt, the
  // Anvil-Heart (Iron), the region's one Bound: a power harnessed OPENLY as the city
  // reactor — the atrocity industrialized, so the free-vs-wield choice is at its
  // starkest. Authored against the shipped template in BOTH world-states: the verdant
  // Reach (the loud, working anvil-city; Halcyon's old frame-yards still turning) and
  // the ashen Ashfall (the foundries cold and silent, Caldecott a warlord remnant).
  // Reach and Ashfall draw DIFFERENT encounter tables so the region reads observably
  // differently across the Reckoning: the Reach works the great foundry and the
  // frame-yards; the Ashfall replaces the foundry with the black-market ripper row as
  // the warlord's economy takes over. The Korrholt Bound-site free-vs-wield interaction
  // reuses the shipped Bound-site template (#135) + Phase-2 kit (#69); this authors the
  // region identity, key locations, per-region encounters, side-stories, and both
  // variants (stat blocks / palettes / dialogue are living docs, decision 0003).
  holtspire: {
    id: RegionIds.holtspire,
    boundSite: BoundIds.korrholt,
    states: {
      reach: {
        name: "The Holtspire Reach — the Working Anvil-City",
        tone: "verdant",
        keyLocations: [
          { id: "the-great-foundry", name: "The Great Foundry" },
          { id: "the-frame-yards", name: "The Frame-Yards" },
          { id: "ripper-row", name: "The Black-Market Ripper Row" },
          { id: "the-anvil-heart", name: "Korrholt, the Anvil-Heart" },
        ],
        encounters: [EncounterIds.theGreatFoundry, EncounterIds.frameYards],
        sideStories: [
          { id: "caldecotts-resentment", name: "Caldecott's Resentment" },
        ],
      },
      ashfall: {
        name: "The Holtspire Ashfall — the Cold Foundries",
        tone: "ashen",
        keyLocations: [
          {
            id: "the-great-foundry",
            name: "The Great Foundry (cold and silent)",
          },
          { id: "the-frame-yards", name: "The Frame-Yards (rusting)" },
          { id: "ripper-row", name: "The Ripper Row (a warlord's market)" },
          { id: "the-anvil-heart", name: "Korrholt, the Anvil-Heart (banked)" },
        ],
        encounters: [EncounterIds.frameYards, EncounterIds.ripperRow],
        sideStories: [
          {
            id: "caldecotts-resentment",
            name: "Caldecott, the Warlord Remnant",
          },
        ],
      },
    },
  },
  // Cinderfen (#131): the ashlands — strip-mined, magic-dead wastes of abandoned
  // grist-mines and dead refineries, holding the Ashfast enclave (Brother Asch's
  // order) (wiki/design/regions.md — the Cinderfen). Sites Morrath, the Cinder-bound
  // (Ash), the region's one Bound: a dying, half-rendered power, a moral gut-punch
  // more than a fight. Unlike the other regions it reads the SAME across the
  // Reckoning by design — both variants `ashen`: the Reach is already ruin amid a
  // still-living world, the Ashfall barely changed because now the rest of the world
  // looks like it. Its observable divergence is therefore NOT tone but the ENCOUNTER
  // TABLE (Reach strip-mines still picked over → Ashfall silent haunted
  // cinder-wastes), so the run digests differently across the flag. The Morrath
  // Bound-site reuses the shipped template (#135) + Phase-2 kit (#69); stat blocks /
  // palettes / dialogue are living docs (decision 0003).
  cinderfen: {
    id: RegionIds.cinderfen,
    boundSite: BoundIds.morrath,
    states: {
      reach: {
        name: "The Cinderfen Reach — the Ashlands Already Fallen",
        tone: "ashen",
        keyLocations: [
          { id: "the-grist-mines", name: "The Abandoned Grist-Mines" },
          { id: "the-ashfast-enclave", name: "The Ashfast Enclave" },
          { id: "the-felled-bound", name: "The Bones of a Felled Bound" },
          { id: "the-cinder-bound", name: "Morrath, the Cinder-bound" },
        ],
        encounters: [
          EncounterIds.theStripMines,
          EncounterIds.theDeadRefineries,
        ],
        sideStories: [
          { id: "brother-aschs-vigil", name: "Brother Asch's Vigil" },
        ],
      },
      ashfall: {
        name: "The Cinderfen Ashfall — the World Made Ashlands",
        tone: "ashen",
        keyLocations: [
          { id: "the-grist-mines", name: "The Grist-Mines (silent)" },
          { id: "the-ashfast-enclave", name: "The Ashfast Enclave (a vigil)" },
          { id: "the-felled-bound", name: "The Bones of a Felled Bound" },
          { id: "the-cinder-bound", name: "Morrath, guttering out" },
        ],
        encounters: [
          EncounterIds.theDeadRefineries,
          EncounterIds.theCinderWastes,
        ],
        sideStories: [
          { id: "brother-aschs-vigil", name: "Brother Asch, the Last Warden" },
        ],
      },
    },
  },
  // The Wrack (#132): the Sundering coast — a broken tidal coast under Threne's
  // shadow, where the Sundering's wound is rawest, home to an oblivion-cult that
  // courts the end (Sallow's unwitting congregation) (wiki/design/regions.md — the
  // Wrack, the Sundering coast). Sites Threnos, the Unmade (Gloom), the region's one
  // Bound: the most alien, entropy-touched power, which foreshadows the finale. The
  // Wrack reads in BOTH world-states — the Reach (the raw scar and the cult's hold)
  // and the Ashfall (the sea pulling back, the scar widening — the edge of the end):
  // unlike the Cinderfen it DOES turn `verdant`→`ashen` across the Reckoning, AND its
  // encounter table diverges (Reach scar + cult-hold → Ashfall cult-hold + the sunken
  // Choir-shrine the retreating sea lays bare), so the run reads and digests as two
  // places. The Threnos Bound-site reuses the shipped template (#135) + Phase-2 kit
  // (#69); stat blocks / palettes / dialogue are living docs (decision 0003).
  wrack: {
    id: RegionIds.wrack,
    boundSite: BoundIds.threnos,
    states: {
      reach: {
        name: "The Wrack Reach — the Sundering's Rawest Wound",
        tone: "verdant",
        keyLocations: [
          { id: "the-sundering-scar", name: "The Sundering-Scar" },
          { id: "the-oblivion-hold", name: "The Oblivion-Cult's Hold" },
          { id: "the-choir-shrine", name: "The Sunken Choir-Shrine" },
          { id: "the-unmade", name: "Threnos, the Unmade" },
        ],
        encounters: [
          EncounterIds.theSunderingScar,
          EncounterIds.theOblivionHold,
        ],
        sideStories: [
          {
            id: "sallows-congregation",
            name: "Sallow's Unwitting Congregation",
          },
        ],
      },
      ashfall: {
        name: "The Wrack Ashfall — the Edge of the End",
        tone: "ashen",
        keyLocations: [
          { id: "the-sundering-scar", name: "The Sundering-Scar (widening)" },
          {
            id: "the-oblivion-hold",
            name: "The Oblivion-Cult's Hold (ascendant)",
          },
          { id: "the-choir-shrine", name: "The Choir-Shrine (laid bare)" },
          { id: "the-unmade", name: "Threnos, waking" },
        ],
        encounters: [
          EncounterIds.theOblivionHold,
          EncounterIds.theDrownedChoir,
        ],
        sideStories: [
          {
            id: "sallows-congregation",
            name: "Sallow's Congregation, at the End",
          },
        ],
      },
    },
  },
};
