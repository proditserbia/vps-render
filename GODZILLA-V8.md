# Godzilla v8 — right logo at the frame boundary

Only the outgoing right YouTube logo's numeric calibration changes. V7 is preserved in `ArtistGodzillaV7.tsx`, `godzilla-measured-v7.json` and `godzilla-side-graphics-v7.json`. Current composition IDs end in `-v8`.

## Correction

V7 interpolated across the right logo's invisible interval, which did not reliably describe its tiny visible edge on re-entry. Its final clipped tail also inherited a frozen perspective that could be aligned more closely.

V8 refines 15 poses: frames 232–234, 246–250 and 271–277. It extrapolates from the nearest visible pose rather than across the invisible gap, then fits bounded screen-space position, scale, shear and rotation adjustments to the actual visible artwork. The fit penalizes extra logo pixels on reference-white background and excludes the photograph. The right logo reappears at frame 246, matching the first small red edge in AE.

The runtime still renders the original logo asset. It does not use reference-frame cutouts. Changes are confined to `right.exitLogoTrack` and `right.exitLogoGap` in `godzilla-side-graphics.json`.

## Preservation and checks

All left calibration, all original scene geometry, and every other right-side calibration field are unchanged. Central text, video, reflection settings, input/output contracts and timings remain as in v7. Sequential v7/v8 renders in the same browser at frame 274 confirm pixel-identical left and center crops. TypeScript passes.

Native stills were compared visually at the partially clipped boundary and the final exit. `tools/validate-godzilla-v8.py` checks 50 consecutive finished-video frames (230–279) in the lower-right logo region, excluding the photograph, and separately reports the 15 modified poses. It also creates `AE-v7-v8-RightLogo.jpg`, `AE-v8-InSitu.jpg` and `validation.json` in `out/godzilla-v8`.

Completed Flat validation: mean absolute RGB error in the specified region across the 15 modified frames falls from 0.3813 to 0.1466. Twelve improve; the three others differ by less than 0.007 error units. The main boundary problems at frames 233–234 and 246–248 improve substantially. The finished AE/v7/v8 sheet was visually inspected. Flat metadata confirms 6276 × 834, 60 fps, 900 frames / 15 seconds.

The completed InSitu movie is 1920 × 1080, 60 fps, 900 frames / 15 seconds. Finished frames 247 and 274 were visually compared with AE in `AE-v8-InSitu.jpg`. Both full renders completed successfully.

Subpixel antialiasing and tiny silhouette differences may remain; the reference and browser use different rendering pipelines. These comparisons are regional checks, not an overall similarity percentage.

## Render

From this `remotion-templates` directory:

```powershell
node scripts/godzilla-review.mjs video
```

- `out/godzilla-v8/Artist_Godzilla_Flat_v8.mp4`
- `out/godzilla-v8/Artist_Godzilla_InSitu_v8.mp4`

Use `insitu` instead of `video` for only the mockup. Both review movies retain 15 seconds, 60 fps and muted audio. The script defaults to installed Chrome; `GODZILLA_BROWSER` can override the executable path.
