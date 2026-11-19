# Godzilla v3 — perspective and in-situ reflection

V3 preserves the v1/v2 compositions and existing review movies. All seven new composition IDs end in `-v3`. Inputs, sizes, 60 fps and 900-frame duration are unchanged.

## Changes

- Refined partially visible white artist-name perspective using isolated glyph contours, then whole-word image registration. This avoids matching the wrong repeated letters near the edge of the screen. 25 poses passed correlation/error checks.
- Calibrated opening/side browser glyph bounds before perspective transformation. Artist, song and pill remain editable text.
- Refined the shared outgoing text plane and placed it behind the turning photograph where their projections overlap.
- Removed two degenerate photo measurements at frames 262/264. Filled the intervening near-edge-on poses from valid neighboring measurements and repaired the photo silhouettes at 261–268. The incoming video is now excluded from the outgoing photo area; its broad matte previously covered the photograph with black.
- Split canopy rendering into live reflected content and foreground glass transmission/tint. Calibrated on frames 180, 270 and 360, with 240, 310 and 420 held out for checking. The experimental bump-lighting shader was rejected after it increased error and is not included.

Runtime changes are in `ArtistGodzilla.tsx`, `GodzillaGlass.tsx`, `godzilla-measured.json`, `godzilla-copy-calibration.json` and `godzilla-glass-calibration.json`. V2 code/data are archived as `ArtistGodzillaV2.tsx` / `godzilla-measured-v2.json`.

Only numeric calibration and geometry are stored from the reference analysis. No AE reference frames are used at runtime. Reflection remains a live copy of the editable composition.

## Historical v3 render

**The shared review script now targets v4.** Existing v3 files are preserved. To re-render v3, use the `artist-godzilla-flat-v3` or `artist-godzilla-insitu-v3` composition ID with the Remotion CLI. The commands below describe the script when v3 was current.

Run from this remotion-templates directory:

```powershell
node scripts/godzilla-review.mjs video
```

This creates:
- `out/godzilla-v3/Artist_Godzilla_Flat_v3.mp4`
- `out/godzilla-v3/Artist_Godzilla_InSitu_v3.mp4`

Use `insitu` for only the mockup, `stills` for flat comparison frames, `insitu-still` for six mockup frames, and `panels` for native master/panel stills. The script uses installed Edge, disables bundle caching, and renders in-situ with concurrency 1.

Optional selected flat frames:
```powershell
$env:GODZILLA_FRAMES='250,260,264,268,310,315'
node scripts/godzilla-review.mjs stills
Remove-Item Env:GODZILLA_FRAMES
```

## Validation and limits

TypeScript passes. Native stills were compared against AE, including full-resolution text at frames 310/315 and the canopy at six matching times. The still-image canopy error was lower than v2 at all six sampled frames; final encoded-movie results are stored in `out/godzilla-v3/glass-validation.json`. Flat comparisons and transform/mask checks are stored in `validation.json`.

The encoded InSitu MP4 is confirmed as 1920 x 1080, 60 fps, 900 frames / 15 seconds. Its canopy error is lower than v2 at all six checked frames: 180 (13.12 to 11.08), 240 (13.46 to 12.35), 270 (14.20 to 12.35), 310 (12.86 to 11.14), 360 (12.05 to 10.49), and 420 (13.06 to 12.58). Decoded-film comparison sheets `AE-v2-v3-InSitu.jpg` and `AE-v2-v3-glass.jpg` were visually inspected.

The encoded flat MP4 is confirmed as 6276 x 834, 60 fps, 900 frames / 15 seconds. 15 of 18 sampled frames have lower full-frame RGB error than v2. Frame 310 improves from 7.93 to 5.38, frame 315 from 6.72 to 5.81, and frame 260 from 102.65 to 13.59. Frame 246 worsens from 8.79 to 9.51; frame 264 from 46.63 to 49.72; frame 308 is effectively unchanged (8.804 to 8.808). These exceptions are retained explicitly rather than presenting the sample as uniformly improved.

The canopy comparison is a local pixel metric, not an overall similarity percentage. Fine glass displacement, grain and renderer antialiasing remain approximate. Near-edge-on photo/video geometry around 4.3–4.5 seconds is improved but still differs from AE; it requires continuous visual review. Replacement copy/assets and final panel movies still require approval with production inputs. This is a visual-review iteration, not a claim of final production approval.

No Firebase Functions, frontend workflow or render-server contract changes.
