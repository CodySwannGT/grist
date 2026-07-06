# grist — Asset Licenses & Provenance

The art under `assets/src` (and therefore everything packed into `public/assets`)
comes from **two source lanes**, each with its own rights:

1. **Bespoke PixelLab lane (#203)** — the party + enemy **battler cast**
   (`sprites/battlers/`) and the dialogue **portraits** (`sprites/portraits/`) are
   AI-generated pixel art created with **[PixelLab](https://www.pixellab.ai)** under
   an active paid subscription. PixelLab's terms grant the *creator* ownership of
   the output (see the verbatim quotes below), so these are **owned project
   assets**, not CC0. There is no re-downloadable pack: the committed generated
   PNGs under `assets/pixellab-raw/<ref>/` ARE the provenance, and
   `assets/pixellab-manifest.json` traces every ref to its PixelLab `character_id`
   (the provenance anchor, present for all 16 refs) plus the per-step job ids
   where the generator captured them and the uniform trim rect applied during
   ingest. Two refs carry a partial job log — `tobi` (recovered via
   `GET /characters/{id}` after a mid-run download crash) and `asch` (only its
   re-run `walk-south` job was re-logged) — noted in the manifest's `_provenance`
   field; both retain their `character_id`.
2. **CC0 pack lane** — battle **FX** (`sprites/fx/`), **UI chrome**
   (`sprites/ui/`), temp **audio** (`audio/`), and the per-region parallax
   **backdrops** (`images/<region>/`) remain dedicated to the public domain under
   **Creative Commons Zero v1.0 Universal (CC0)**
   (https://creativecommons.org/publicdomain/zero/1.0/), carved from the packs
   below. The region backdrops are deterministic palette-shift derivatives of one
   CC0 Warped City set (a CC0 work's derivatives stay CC0). Attribution is not
   required; the credits are courtesy acknowledgements.

`assets/src` is (re)built by `scripts/ingest-assets.mjs` — the per-frame
provenance record. Adding art from a NEW source requires: (1) license / ownership
evidence recorded here, and (2) an ingest entry or committed source file.

## PixelLab (bespoke battler cast + portraits, #203)

**License gate — human approval on record.** Per the `phaser-asset-sourcing`
license gate, non-CC0/non-public-domain art requires an explicit human approval
of the rights to use it. The repository owner holds an **active PixelLab "Tier 1:
Pixel Apprentice" subscription** (verified via the PixelLab API `GET /balance`:
`subscription: active`, 244/2000 monthly generations used at integration time)
and **approved** generating and shipping this full cast for grist under that
subscription (decision recorded on issue #203, parent epic #199). PixelLab's terms
assign ownership of generated content to the creator and permit commercial use
including in-game assets, so grist owns and may ship this art.

**Verbatim ownership & usage terms** (PixelLab Terms of Service,
https://pixellab.ai/termsofservice, fetched 2026-07-06):
> "You retain ownership of any content you create using PixelLab."
>
> "You are free to use, modify, and distribute the outputs from our tools for any
> purpose, except for training other models without our explicit permission."

Key restrictions we comply with: generated images are **not** used to train other
models, and programmatic API access is used only for in-game asset creation (both
permitted uses). PixelLab layers the **Open RAIL-M** use-based restrictions onto
the output; grist's use (a game's character art) falls within them. Users are
responsible for ensuring outputs don't infringe third-party rights — this cast is
generated from grist's own character briefs (`wiki/narrative/characters.md`,
`wiki/design/art-direction.md`) with a project palette lock, not from third-party
IP.

| Source | Tool | Plan | Ownership | Evidence |
|--------|------|------|-----------|----------|
| PixelLab AI pixel-art generation | https://www.pixellab.ai | Tier 1 (active, paid) | Creator-owned per ToS ("You retain ownership…") | `assets/pixellab-manifest.json` (character_id for all refs + per-step job ids where captured; see its `_provenance` note); PixelLab ToS quotes above; human approval on #203 |

## CC0 packs (FX, UI, audio, backdrops)

| Pack | Author | Source | License | Evidence |
|------|--------|--------|---------|----------|
| Ninja Adventure – Asset Pack | Pixel-boy & AAA | https://pixel-boy.itch.io/ninja-adventure-asset-pack | CC0 1.0 | In-pack `LICENSE.txt` (full CC0 text) + `README.md`; itch page "Creative Commons Zero v1.0 Universal" |
| Warped City | Luis Zuno (ansimuz) | https://ansimuz.itch.io/warped-city | CC0 1.0 | itch page "Asset license: Creative Commons Zero v1.0 Universal" (base pack only; the paid add-on is not used) |

## What each pack provides

> **Note (#203):** Ninja Adventure no longer supplies the battler sprites or
> dialogue portraits — those are now the bespoke PixelLab cast above. Ninja
> Adventure still supplies FX, UI chrome, and temp audio.

- **Ninja Adventure**: battle FX (`sprites/fx/` — the slash/spark/smoke base
  flavors, the five per-element craft strips carved from `FX/Elemental/`
  (Thunder→flux, Flam→ash, Rock→iron, Plant→bloom, Ice→gloom), and the
  Explosion→Break burst, #201), and UI chrome (`sprites/ui/` — the flat
  dialog/choice boxes, the arrow cursor, and the `panel` 9-slice terminal frame
  carved from `Ui/Theme/Wip/ThemeMetal3/nine_path_panel.png`, #202).
  It also supplies the temp (demo-quality) audio (`assets/src/audio/`, #115):
  the opening **Choir-leitmotif** fragment (`choir-leitmotif.ogg`, the pack's
  `Audio/Musics/6 - Story (Short).ogg`) and the three resonant stingers —
  **grist-spend** (`grist-spend.wav`, `Audio/Sounds/Bonus/Gold1.wav`), **Break**
  (`break.wav`, `Audio/Sounds/Hit & Impact/Impact.wav`), and **Rendering**
  (`rendering.wav`, `Audio/Sounds/Magic & Skill/Spirit.wav`). All copied verbatim
  (no re-encode) so the pipeline stays byte-reproducible without ffmpeg.
- **Warped City**: the single source parallax set every region's side-view
  backdrop is carved from (#200, Art pass II). The Marrow keeps the pack verbatim
  (`assets/src/images/marrow/bg-{far,mid,near}.png` — its native neon-over-bone
  read). Every other live region
  (`roots`, `upper-vanta`, `sylvemarch`, `holtspire`, `cinderfen`, `wrack`) is a
  **deterministic palette-shift variant** of those same three CC0 layers, recolored
  toward its art-direction identity (`wiki/design/art-direction.md` §Environment
  design) by a reproducible `jimp` `.color()` pipeline in
  `scripts/ingest-assets.mjs` (hue `spin` + `saturate`/`desaturate` + `mix` toward
  the region's key colour + `darken`/`lighten`). A CC0 work's derivatives are CC0,
  so no new source or license evidence is introduced — this is one artist's set
  (ansimuz, CC0) tinted per region for cohesion over variety. Re-running
  `node scripts/ingest-assets.mjs --packs <dir>` reproduces all seven sets
  byte-for-byte from the CC0 Warped City pack.

## Verbatim license quotes

**Ninja Adventure (README.md):**
> They are released under the Creative Commons Zero (CC0) license. You can use
> any and all of the assets found in this package in your own games, even
> commercial ones. Attribution is not required but appreciated.

(The full CC0 1.0 legal text is included in-pack as `LICENSE.txt`.)

**Warped City (itch.io storefront):**
> Asset license: Creative Commons Zero v1.0 Universal

## Courtesy credits (optional, not required by CC0)

- Ninja Adventure by Pixel-boy & AAA — https://pixel-boy.itch.io/
- Warped City by ansimuz (Luis Zuno) — https://ansimuz.itch.io/
