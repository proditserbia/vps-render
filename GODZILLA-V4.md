# Godzilla v4 — near-edge-on transition and glass reflection

V4 targets the transition around 4.4 seconds. V1, v2 and v3 remain registered and their existing movies are preserved. New IDs end in `-v4`; inputs, dimensions, 60 fps and 900-frame duration are unchanged.

## Changes

- Refined photo geometry at frames 256–268 using reference image registration and dense color alignment. The nearly featureless, strongly magnified shoulder requires bounded interpolation between reliable poses; frame 263 uses an inverse-projection bridge between neighboring fitted poses to avoid a collapsed fit.
- Extended the photo matte above the initial visible canvas, following the original 1920 x 1080 rounded AE rectangle. The base still's clipped top edge is not the full 3D card boundary.
- Added incoming-video poses for 262–271, which previously inherited the first measured pose at 272. Added separate video silhouettes for these frames, derived from the visible lower edge without including the outgoing photo.
- Normalized video homography scale before interpolation so equivalent matrices of opposite sign do not create a false camera crossing.
- Composed photo image transforms before browser projection near the crossing, with explicit visible-half-space selection. Opening copy is hidden once it has left the frame, preventing a stray reversed word from reappearing.
- Softened the live canopy reflection by approximately 1.5 output pixels and recalibrated foreground transmission and color. The fit uses frames 180, 270, 360; frames 240, 310, 420 remain held-out checks. No reference pixels are used in the runtime.

V3 source/data/glass filters are archived as `ArtistGodzillaV3.tsx`, `godzilla-measured-v3.json`, `GodzillaGlassV3.tsx`, and `godzilla-glass-calibration-v3.json`. V4 uses the main source filenames.

## Historical v4 render

The shared script now targets v5. Existing v4 movies and composition IDs remain available. The commands below describe the script when v4 was current.

Run from this remotion-templates directory:

```powershell
node scripts/godzilla-review.mjs video
```

Outputs:
- `out/godzilla-v4/Artist_Godzilla_Flat_v4.mp4`
- `out/godzilla-v4/Artist_Godzilla_InSitu_v4.mp4`

For only the mockup use `insitu`. For six reference mockup frames use `insitu-still`. Selected flat frames:

```powershell
$env:GODZILLA_FRAMES='258,260,262,263,264,265,266,268,270'
node scripts/godzilla-review.mjs stills
Remove-Item Env:GODZILLA_FRAMES
```

The script uses installed Edge and disables bundle caching. InSitu concurrency remains 1.

## Verification and remaining differences

TypeScript passes. Native stills around the crossing were inspected, including the previously problematic frame 263. Glass still comparisons improve on v3 at all six checked times. Final encoded-film measurements are written to `out/godzilla-v4/validation.json` and `glass-validation.json`; comparison sheets are `AE-v3-v4-InSitu.jpg` and `AE-v3-v4-glass.jpg`.

The completed flat MP4 is 6276 x 834, 60 fps, 900 frames / 15 seconds. All checked transition frames from 256 through 268 improve versus v3. Full-frame mean absolute RGB error falls from 49.72 to 7.82 at frame 264 (4.4 s), 49.97 to 8.37 at 263, and 73.23 to 9.48 at 265. Frame 270 worsens slightly (9.60 to 9.89), as does 281 (15.84 to 15.94); several unchanged frames differ by only encoding noise. The complete results are retained rather than treating the local improvement as a global similarity percentage.

The completed InSitu MP4 is 1920 x 1080, 60 fps, 900 frames / 15 seconds. Its decoded-film canopy error improves in 5 of 6 samples: frame 180 (11.08 to 10.74), 240 (12.35 to 11.82), 270 (12.35 to 11.62), 310 (11.14 to 11.01), and 420 (12.58 to 12.08). Frame 360 is effectively unchanged/slightly worse (10.49 to 10.53), despite improving in the lossless still comparison. Both decoded comparison sheets were visually inspected.

The geometry is measured/approximated from the supplied reference, not an exact AE camera/effects implementation. Small texture, player-graphics and edge differences remain in the near-edge-on frames. The reflection treatment approximates softness/transmission; it does not reproduce all CC Glass displacement, specular highlights or AE's animated grain. Local error metrics are not an overall percentage similarity score.

Replacement copy/assets and production panel delivery still require visual approval. No Firebase or render-server contract changes are included.
