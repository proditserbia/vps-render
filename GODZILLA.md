# Godzilla v1 — visual review implementation

**Version note:** v10 is available; see [GODZILLA-V10.md](GODZILLA-V10.md). The review script targets v10 and writes `out/godzilla-v10`. Earlier IDs and movies remain available.

The NY Godzilla compositions are registered in `src/Root.tsx`; implementation is in `src/compositions/ArtistGodzilla.tsx`. This is a first visual review version, not a final approved delivery or a completed backend integration.

## Outputs

All compositions run for 900 frames at 60 fps (15 seconds).

| Composition ID | Size | Master crop x |
| --- | --- | --- |
| artist-godzilla-flat-v1 | 6276 × 834 | proxy |
| artist-godzilla-master-v1 | 12552 × 1666 | 0 |
| artist-godzilla-farleft-panel01-v1 | 2352 × 1666 | 0 |
| artist-godzilla-centerleft-panel02-v1 | 4124 × 1666 | 2352 |
| artist-godzilla-centerright-panel03-v1 | 4124 × 1666 | 6476 |
| artist-godzilla-farright-panel04-v1 | 1952 × 1666 | 10600 |
| artist-godzilla-insitu-v1 | 1920 × 1080 | mockup |

The proxy is scaled by 2 and cropped to the AE master's 1666-pixel height. The four panel compositions crop that shared master. The middle creative spans panels 2 and 3.

## Inputs and assets

Edit `fixtures/artist-godzilla.json`: `artistName`, `songTitle`, `pillCopy`, `featuredArtistImage`, `featuredVideo`, and `background`. Asset paths are relative to `public`, or HTTP(S) URLs. The initial fixture reuses the LA test image and video under `public/assets/la-sunset`; fonts and player artwork also reuse existing assets. Keep those dependencies when packaging the template.

Video starts at composition frame 262, with source time zero. Use a sufficiently long source (at least 10.634 seconds) and inspect replacement aspect ratios and long text before approval. Output review movies are muted.

`public/assets/godzilla/insitu-background.png` and `insitu-foreground.png` were exported from a temporary duplicate of the original AE in-situ composition with the animated billboard layers disabled. The foreground is an occlusion mask tied to this particular background and geometry; changing only the background prop does not create a new calibrated mockup.

`src/compositions/godzilla-measured.json` contains numeric animation transforms and masks measured from the AE reference, not reference image frames. Text, photo and video remain editable. No files from `renders/AE` are required at runtime.

## Local review

Run from this `remotion-templates` directory in PowerShell:

```powershell
node scripts/godzilla-review.mjs stills
node scripts/godzilla-review.mjs video
node scripts/godzilla-review.mjs insitu
node scripts/godzilla-review.mjs panels
npx tsc --noEmit
```

The script uses the installed Microsoft Edge browser and disables bundle caching so visual comparisons use current code. Output folder: `out/godzilla-v1`. `video` creates the flat and in-situ review MP4s; `insitu` retries only the in-situ movie; `panels` creates master and four panel stills at frame 420 for a seam check, not panel movies. In-situ renders use concurrency 1 after a compositor frame-extraction failure during the first concurrency-4 run.

Example native panel movie:

```powershell
npx remotion render src/index.ts artist-godzilla-farleft-panel01-v1 out/godzilla-v1/Artist_Godz_FarLeft_Panel01.mp4 --props=fixtures/artist-godzilla.json --browser-executable="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --codec=h264 --muted
```

The native master is wider than common H.264 playback limits; render individual panels for delivery and use the proxy for review. Final delivery codec/bitrate must follow the approved specification.

## Remaining review scope

- Compare motion continuously against the supplied AE references, especially outgoing photo rotation, text entrances and player progress.
- In-situ perspective and occlusion are implemented; AE glass/reflection effects are approximated rather than reproduced by the AE renderer.
- Replacement inputs and extreme text lengths need visual approval.
- NY social, Megazilla and Firebase job orchestration / multi-output packaging are separate work. This change does not alter Functions or the render server contract.

Measurement/export helpers are in the workspace's `tools` directory. They are development utilities and are not needed for normal Remotion rendering.

## Validation

- TypeScript check passes. Full lint is unavailable because the existing repository has no ESLint configuration.
- Flat MP4 verified with ffprobe: 6276 × 834, 60/1 fps, 900 frames, 15 seconds.
- In-situ retry completed successfully at concurrency 1; MP4 verified: 1920 × 1080, 60/1 fps, 900 frames, 15 seconds. Extracted movie frames were inspected, including the flat transition and the in-situ billboard view.
- Independent master/panel stills at frame 420 have the expected dimensions and total width. Mean RGB difference after stitching is below 0.003 / 255. Outer seams match exactly; the middle seam has sparse sampling differences (maximum 7 / 255, mean below 0.005 / 255), so these independent browser renders are not bit-identical.
- `out/godzilla-v1/panel-check.json` records those measurements. `AE-vs-Remotion.jpg` pairs eight reference frames with the matching new frames.
