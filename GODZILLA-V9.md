# Godzilla v9 — side player graphics at the end of the 3D transition

V9 refines the player graphics on the outgoing left and right photographs. V8 remains registered and archived as `ArtistGodzillaV8.tsx`, `godzilla-measured-v8.json` and `godzilla-side-graphics-v8.json`.

## Changes

- Measured the progress-line thickness and dot radius separately for each side. The former common 13-pixel line and 18.85-pixel dot were too large, especially on the right. The calibrated sizes are 11.5 / 16.5 pixels on the left and 9 / 13 pixels on the right before projection.
- Added separate, bounded screen-space position corrections for the Like and Subscribe assets. Each is measured against its own AE graphic, rather than moving both together. Corrections are smoothed to reduce fitting noise and are applied independently inside the existing photograph's world-space clipping mask.
- The strongest lens-warp interval cannot be represented by a single plane. Corrections blend back toward the prior placement there: left frames 267–269, right 263–266, with gradual ramps on either side. This avoids worsening the few near-edge-on frames while improving the final exit.

Runtime measurements are numeric tracks `photoLikeOffset` and `photoButtonOffset` in `godzilla-side-graphics.json`. The original image assets remain in use; reference pixels are not shipped as footage.

## Preservation and checks

Original scene geometry and all existing calibration fields are unchanged, including both outgoing logos and the incoming icon/text/button animations. The central component retains its prior line, dot and button rendering. In sequential, same-browser v8/v9 stills, center pixels are identical at frames 264, 268 and 274. TypeScript passes.

Stills were visually compared against AE during iteration. `tools/validate-godzilla-v9.py` checks every frame from 240 through 300 in finished movies and reports whole-side and player-graphic-region errors separately. It creates `validation.json`, `AE-v8-v9-Sides.jpg` and `AE-v9-InSitu.jpg` in `out/godzilla-v9`.

Finished Flat validation: across all 61 frames, mean absolute RGB error in the player-graphic region falls from 8.29 to 7.74 on the left (56 frames improve), and 9.25 to 8.02 on the right (55 improve). Whole-side means fall from 4.383 to 4.299 and 4.875 to 4.684 respectively. These are local comparison values, not overall similarity percentages; a few frames retain small differences or regressions. The decoded AE/v8/v9 sheet was visually inspected. Flat metadata confirms 6276 × 834, 60 fps, 900 frames / 15 seconds.

The completed InSitu movie is 1920 × 1080, 60 fps, 900 frames / 15 seconds. Decoded frames 264, 274 and 280 were visually compared with AE in `AE-v9-InSitu.jpg`. Both full renders completed successfully.

Remaining limits include AE's non-projective lens distortion, the photographed image's existing alignment differences, and small graphic silhouette/antialiasing differences. This is a targeted side-graphics refinement, not a claim of complete pixel equivalence to AE.

## Render

From this `remotion-templates` directory:

```powershell
node scripts/godzilla-review.mjs video
```

- `out/godzilla-v9/Artist_Godzilla_Flat_v9.mp4`
- `out/godzilla-v9/Artist_Godzilla_InSitu_v9.mp4`

Use `insitu` for only the mockup. Both review movies retain the existing muted 15-second, 60-fps settings. Current composition IDs end in `-v9`; the script uses installed Chrome by default.
