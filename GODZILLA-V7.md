# Godzilla v7 — outgoing side-logo perspective

V7 changes only the outgoing YouTube wordmarks on the left and right creative panels. V6 remains registered with its source and calibration archived in `ArtistGodzillaV6.tsx`, `godzilla-measured-v6.json`, and `godzilla-side-graphics-v6.json`.

## Change

The previous logo inherited the photograph's perspective and then received a screen-space position correction. The AE logo has an independent transform, so its inclination and foreshortening remained visibly different during the turn.

V7 fits the existing editable logo asset to consecutive AE frames using a projective transform. Photo pixels are masked out during fitting. Tracking uses the logo's own motion and visible red-icon position, independently of the photograph. The resulting numeric transforms are stored in `godzilla-side-graphics.json` as `exitLogoTrack`.

Accepted poses use high-correlation matches with a positive projective depth over the wordmark. Gaps interpolate projected corners rather than arbitrarily scaled homography coefficients. The final tiny clipped tails retain the last well-constrained perspective and follow the visible edge. The brief intervals when the complete logo is outside the AE frame are recorded separately. No reference-frame pixels are shipped in the composition.

The fully clipped tails cannot constrain a complete perspective as reliably as visible artwork. They are stabilized approximations. Small antialiasing and AE lens-distortion differences can remain.

## Preservation and validation

Central rendering, all original geometry, other side calibration fields, input props, output sizes, timing, and glass/reflection settings are unchanged. The same-browser lossless center crop at frame 279 is pixel-identical to v6. TypeScript passes.

Native stills were compared visually against AE at the beginning, middle and end of the logo exit. The finished-movie validator `tools/validate-godzilla-v7.py` checks all 93 frames from 196 through 288 in the lower logo area, excluding the photograph. It writes `validation.json`, `AE-v6-v7-Logo.jpg` and `AE-v7-InSitu.jpg` under `out/godzilla-v7`. These metrics describe the specified region, not whole-template similarity.

Completed Flat validation: mean absolute RGB error in that region falls from 3.85 to 0.43 on the left and 1.88 to 0.40 on the right. All 93 left samples and 79 right samples improve. Small regressions remain at the right logo's clipped boundary, most noticeably frames 247–248; other non-improving samples largely contain tiny residual differences while the logo is out of frame. The decoded AE/v6/v7 comparison sheet was visually inspected. The Flat movie is 6276 × 834, 60 fps, 900 frames.

The completed InSitu movie is 1920 × 1080, 60 fps, 900 frames. Decoded frames 250, 260, 270 and 279 were compared visually with AE in `AE-v7-InSitu.jpg`. Both full renders completed successfully.

## Render

From this `remotion-templates` directory:

```powershell
node scripts/godzilla-review.mjs video
```

- `out/godzilla-v7/Artist_Godzilla_Flat_v7.mp4`
- `out/godzilla-v7/Artist_Godzilla_InSitu_v7.mp4`

Use `insitu` instead of `video` for only the mockup. The script uses installed Chrome, with an optional `GODZILLA_BROWSER` override. Both muted review movies keep the existing 15-second, 60-fps settings. Current composition IDs end in `-v7`.
