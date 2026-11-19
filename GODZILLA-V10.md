# Godzilla v10 â€” residual lens curvature on side photographs

V10 refines the strongest lens bend during the outgoing 3D transition. V9 is archived and remains registered, including its measured and side-graphics data. Only the outgoing photograph on each side receives the new correction. Center rendering, outgoing logos, player artwork, incoming typography, silhouettes, and glass/reflection settings retain v9 behavior.

## Geometry

The AE reference applies non-projective lens distortion that a single homography cannot reproduce. `tools/godzilla-v10-measure-warp.py` fits a robust cubic displacement field from image-feature correspondences between AE and v9, at every frame from 250 through 278. `tools/godzilla-v10-build-maps.py` encodes those numeric fields into 128 Ã— 96 displacement maps in `godzilla-side-warp.json`. These maps contain geometric offsets only, not AE artwork or rendered footage. They remain usable with replacement photograph assets, subject to visual review.

`GodzillaSideWarp.tsx` interpolates adjacent maps in an SVG filter, in world coordinates before the existing photograph silhouette clips the result. Offsets are bounded to Â±40 pixels at proxy resolution. The effect fades in from frame 246 to 250 and out from 278 to 280 on the left and 278 to 284 on the right. The original photograph uses a composed source-to-world transform inside that filter; independently calibrated UI is outside it. Center never enters this branch. The original, unfiltered path remains active outside the correction interval.

## Validation

TypeScript passes. Same-browser, lossless v9/v10 controls show identical center pixels at frames 264, 268 and 274. At frame 284 the entire image is identical. The first control at frame 246 showed a small rendering difference even in the unchanged center, so it is not used as a pixel-identity claim.

In the eroded photograph mask, lossless controls reduce mean absolute RGB error at frame 264 from 12.45 to 6.97 on the left and 15.15 to 6.19 on the right. At frame 268 the corresponding values are 16.06 to 8.00 and 16.88 to 7.07. These are local error measurements, not similarity percentages. The AE/current frame comparison was visually inspected.

`tools/validate-godzilla-v10.py` compares every decoded frame from 246 to 284 against AE, including odd frames and fade boundaries. It writes the validation report and side-by-side sheets under `out/godzilla-v10`. The initial every-second-frame fit was refined to every frame after checks revealed larger residuals at 265, 267 and 269. At frame 267 this reduced the provisional v10 photograph error from about 29 to 11 on the left and 10 on the right. The left fade was shortened after the initial fade regressed at frames 280–281.

Remaining limitations: fitted displacement is an approximation of AE's lens effect; the player graphics still have small independent perspective/silhouette differences. Replacement assets and native master/panel exports still require visual review. No backend changes or approval delivery are included in this iteration.

## Render

From this `remotion-templates` directory:

```powershell
node scripts/godzilla-review.mjs video
```

Outputs: `out/godzilla-v10/Artist_Godzilla_Flat_v10.mp4` and `out/godzilla-v10/Artist_Godzilla_InSitu_v10.mp4`. Use `insitu` to render only the mockup. Both review movies are muted, 15 seconds, 60 fps. Current composition IDs end in `-v10`.

## Finished Flat validation

Across all 39 decoded frames (246–284), photograph-mask mean absolute RGB error falls from 11.29 to 6.87 on the left and 12.24 to 7.41 on the right. Whole-side error falls from 5.75 to 3.79 and 6.39 to 3.97 respectively. Photograph error improves in 31/39 left and 33/39 right frames; small residual differences remain near fade boundaries. The movie has 6276 × 834 pixels, 60 fps and 900 frames.

The finished InSitu export is 1920 × 1080, 60 fps, 900 frames. Decoded frames 264, 274 and 280 were visually compared with AE in `out/godzilla-v10/AE-v10-InSitu.jpg`. Both final full-length movies completed successfully. TypeScript also passes after the final per-frame calibration and left fade adjustment.
