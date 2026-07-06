# grist — Third-Party Asset Licenses

Every art asset under `assets/src` (and therefore everything packed into
`public/assets`) is dedicated to the public domain under **Creative Commons
Zero v1.0 Universal (CC0)**
(https://creativecommons.org/publicdomain/zero/1.0/). Attribution is not
required; the credits below are courtesy acknowledgements.

`assets/src` is carved from the source packs by `scripts/ingest-assets.mjs`
(the per-frame provenance record — which pack, file, and cell every sprite came
from). Adding art from a NEW source requires: (1) CC0 / equivalent license
evidence recorded here, and (2) an ingest entry or committed source file under
`assets/src`.

| Pack | Author | Source | License | Evidence |
|------|--------|--------|---------|----------|
| Ninja Adventure – Asset Pack | Pixel-boy & AAA | https://pixel-boy.itch.io/ninja-adventure-asset-pack | CC0 1.0 | In-pack `LICENSE.txt` (full CC0 text) + `README.md`; itch page "Creative Commons Zero v1.0 Universal" |
| Warped City | Luis Zuno (ansimuz) | https://ansimuz.itch.io/warped-city | CC0 1.0 | itch page "Asset license: Creative Commons Zero v1.0 Universal" (base pack only; the paid add-on is not used) |

## What each pack provides

- **Ninja Adventure**: every battler sprite (party + enemies, sliced per-frame
  into `assets/src/sprites/battlers/<ref>/`), dialogue portraits
  (`sprites/portraits/`), battle FX (`sprites/fx/` — the slash/spark/smoke base
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
