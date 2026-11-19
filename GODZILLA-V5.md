# Godzilla v5 ï¿½ side-panel exit, 4.650ï¿½5.050 s

V5 corrects the outgoing photo on the left/right creative panels over frames 279ï¿½303. V4 remains registered with its source/data archived as ArtistGodzillaV4.tsx and godzilla-measured-v4.json.

## Changes

- Replaced unstable independent photo matches with forward/backward optical-flow tracking through consecutive AE frames. The former transforms collapsed the photo into thin lines or triangles.
- Kept the reliable v4 left-panel poses through frame 282 and anchored the tracked exit to that pose, preserving its original early-interval photo geometry.
- Tracked the left plane through frame 303 and the right through 299. Continued the last measured motion for the few remaining edge pixels, using the measured silhouette rather than an artificial horizontal collapse.
- Rebuilt exit masks with border-pixel handling and a right-edge/top-of-frame constraint. This excludes the new bottom-left YouTube icon from the outgoing photo mask.
- Moved the outgoing YouTube wordmark outside the photograph's clipping mask so it remains attached to the moving card.

Central geometry/data are exactly unchanged from v4. A same-browser, lossless comparison at frame 279 confirms identical center pixels. Glass filters and central text/video are unchanged.

## Render

From this remotion-templates directory:

```powershell
node scripts/godzilla-review.mjs video
```

Outputs are in out/godzilla-v5:
- Artist_Godzilla_Flat_v5.mp4
- Artist_Godzilla_InSitu_v5.mp4

Use insitu for only the mockup. To inspect the side exit:

```powershell
$env:GODZILLA_FRAMES='279,285,291,297,303,305'
node scripts/godzilla-review.mjs stills
Remove-Item Env:GODZILLA_FRAMES
```

The script now defaults to installed Chrome because Edge exited during browser startup in this session. Override with GODZILLA_BROWSER if necessary. No browser download was required.

## Verification and limits

TypeScript passes. Native stills were visually compared against AE. The final-movie validator tools/validate-godzilla-v5.py checks every frame in the reported 279ï¿½303 interval, separately for left/right, and verifies the unchanged center data and lossless control frame. Results and the AE/v4/v5 side comparison are written to out/godzilla-v5/validation.json and AE-v4-v5-Sides.jpg.

The completed flat movie has 900 frames, 60 fps, 15 seconds, and 6276 x 834 dimensions. Across all 25 checked frames, mean whole-panel RGB error falls from 5.96 to 1.19 on the left and 8.39 to 0.95 on the right. Right improves in all 25 frames; left improves in 21. Left frames 279–282 retain slightly higher whole-panel error (0.24–0.66 points) with the now-visible outgoing wordmark; the photo poses there are preserved from v4. The decoded comparison sheet was visually inspected. These are local comparison metrics, not overall similarity percentages.

Small source-photo alignment and player-graphics differences may remain; this is a targeted motion correction, not final visual approval. No Firebase, server, input-schema, output-size, frame-rate or duration changes.


The final InSitu movie is confirmed as 1920 x 1080, 60 fps, 900 frames / 15 seconds. Decoded frames 285 and 303 were visually checked against AE; the paired sheet is AE-v5-InSitu-check.jpg.
