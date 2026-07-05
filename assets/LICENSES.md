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
  Explosion→Break burst, #201), and UI chrome (`sprites/ui/`).
- **Warped City**: the Marrow side-view parallax backdrop layers
  (`assets/src/images/marrow/bg-{far,mid,near}.png`).

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
