# Godzilla v2 — motion refinement

V2 keeps the same inputs, duration, frame rate and output sizes as v1. All seven new composition IDs end in `-v2`. The v1 compositions remain registered from `ArtistGodzillaV1.tsx` and their original measured data is preserved separately.

## Changes

- Filled missing video masks at frames 307–316. During camera motion the video no longer touches the top-left corner, so requiring that contact caused a ten-frame white interruption.
- Extended the moving photograph masks back to frame 190 and remeasured photograph transforms directly against the source image.
- Measured a shared outgoing text plane so the artist, song and pill retain consistent perspective during rotation.
- Remeasured white text entrances at every frame and tracked the partly off-screen artist text backward through adjacent reference frames. Removed the synthetic fade on white text and corrected the earlier pill entrance.
- Calibrated browser text bounds against the settled AE text before applying perspective.
- Corrected the glass canopy's warm tint and attenuation using a localized multiply treatment. Its underlying reflection remains the live editable composition. This remains an approximation of AE CC Glass, not an identical implementation of that effect.
- Separated the side YouTube mark visibility from the small buttons' fade.

## Historical v2 render

**The shared review script now renders v3.** Existing v2 movies remain in `out/godzilla-v2`. To render v2 again, use its composition ID directly:

```powershell
npx remotion render src/index.ts artist-godzilla-insitu-v2 out/godzilla-v2/Artist_Godzilla_InSitu_v2.mp4 --props=fixtures/artist-godzilla.json --browser-executable="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --codec=h264 --muted --concurrency=1
```

The following describes the script when v2 was current:

Run from this `remotion-templates` directory:

```powershell
node scripts/godzilla-review.mjs video
```

This writes `out/godzilla-v2/Artist_Godzilla_Flat_v2.mp4` and `Artist_Godzilla_InSitu_v2.mp4`. In-situ uses concurrency 1, following the successful v1 retry. Use `insitu` to render only the mockup, `stills` for selected comparison frames, or `panels` for master and panel stills.

The original v1 review movies remain in `out/godzilla-v1`. To render an original v1 composition again, use its `-v1` ID through the Remotion CLI.

## Validation and limits

TypeScript passes. The data validation checks finite transforms, strictly ordered keyframes and complete video mask coverage. The workspace helper `tools/validate-godzilla-v2.py` compares matching decoded MP4 frames against the AE sequence and writes `out/godzilla-v2/validation.json`.

The completed flat movie is 6276 × 834, 60 fps, 900 frames / 15 seconds. Ten of eleven sampled flat frames have lower mean absolute RGB error than v1. At frame 240 the error falls from 26.48 to 5.49; the former white interruption at frame 310 falls from 135.31 to 7.93. Frame 270 is a remaining refinement point: error rises slightly from 8.30 to 9.61 after the photograph remeasurement. These measurements use identical default inputs and are not a substitute for continuous motion review.

The in-situ movie also completed successfully: 1920 × 1080, 60 fps, 900 frames / 15 seconds. Its decoded frame 420 was visually inspected. `AE-v1-v2.jpg` contains paired reference and encoded-movie frames.

At reference frame 420, the measured canopy region's mean absolute RGB difference fell from 27.77 to 12.96 on the 0–255 scale after the tint correction. This is a local image comparison, not a claim of overall percentage similarity. Fine glass displacement, grain, antialiasing and some partially off-screen text poses can still differ from AE.

No Firebase workflow or render-server contract changes are included.
