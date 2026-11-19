# Godzilla v6 — side graphic alignment

This revision changes the left and right creative panels only. V5 remains registered with its source and measurements archived in `ArtistGodzillaV5.tsx` and `godzilla-measured-v5.json`. The current composition IDs end in `-v6`.

## Changes

- Calibrated side progress-dot speed separately: the right panel advances more slowly than the left. Corrected right photo-button size and position.
- Added measured screen-space offsets for the outgoing YouTube wordmark. It no longer follows the photo plane's position alone. Orientation still follows that plane, so some perspective differences remain during the strongest turn.
- Replaced the new icon's immediate static appearance with separate left/right entry tracks measured from AE. The left icon enters later and from beyond the lower-left edge.
- Reused the original AE `Primary UI.png` and `Subscribe white.png` assets for the final side buttons, in `public/assets/godzilla/like-white.png` and `subscribe-white.png`. Calibrated their sizes/positions separately and added their bottom-edge entrance and shadow.
- Removed invalid early side-title and pill homographies. They crossed a projective horizon and produced blue radial streaks on the left around frames 335–343. The layers now fade into their first reliable poses at the reference timing. Central text rendering keeps its existing behavior.

Runtime calibration is in `src/compositions/godzilla-side-graphics.json`. It contains numeric layout/motion data, not reference-frame imagery. Artist image, video and copy remain editable through the existing props.

## Preservation and checks

All original `godzilla-measured.json` data remain identical to v5, including central geometry. Central rendering, glass/reflection filters, input contracts, dimensions, frame rate, duration, Firebase and server code were not changed. A same-browser lossless comparison at frame 279 confirms pixel-identical center output.

TypeScript (`tsc --noEmit`) passes. The targeted ESLint command cannot run because this repository has no ESLint configuration; no unrelated lint setup was added.

Native stills were visually compared with AE during iteration. `tools/validate-godzilla-v6.py` compares decoded finished v5/v6 movies with AE at 17 selected frames, checks the central lossless control, records video metadata and produces side and InSitu comparison sheets. These are sampled checks, not a claim of complete AE equivalence.

Completed-movie verification: both videos contain 900 frames at 60 fps (15 seconds). Flat is 6276 × 834; InSitu is 1920 × 1080. All 17 sampled frames improve in whole-panel mean absolute RGB error on both sides: left 9.37 → 3.60, right 5.88 → 4.45. These are local image-difference measurements, not similarity percentages. The final `AE-v5-v6-Sides.jpg` and `AE-v6-InSitu.jpg` sheets were visually inspected; results are in `out/godzilla-v6/validation.json`.

## Render

From this `remotion-templates` directory:

```powershell
node scripts/godzilla-review.mjs video
```

Outputs:

- `out/godzilla-v6/Artist_Godzilla_Flat_v6.mp4`
- `out/godzilla-v6/Artist_Godzilla_InSitu_v6.mp4`

Use `insitu` instead of `video` to render only the mockup. The script uses installed Chrome by default; `GODZILLA_BROWSER` overrides its path. Movies are review proxies and muted, as in v5.

Remaining visual limits include the outgoing wordmark's exact perspective, subpixel icon silhouette/perspective during entry, and small button/text differences during the transition. The center remains the approved baseline.
