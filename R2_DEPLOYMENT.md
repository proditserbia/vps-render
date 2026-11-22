# US DOOH R2 — local changes, 20 November 2026

Source: `review/r1/[Brief] YTS Template Stamper Q4 .pdf`, pages 5–6, 13, 18 and 21, plus the client's Slack feedback. No Firebase, Storage, IAM or VPS changes were made in this pass.

## Changes

- LA: static in-situ is now a 1920×1080 JPG. Package catalog, job dispatch, renderer and callback agree on the format. Older MP4 static-in-situ jobs retain their original format. New packages are required to obtain the new JPG output.
- LA: black YouTube logo begins its downward/sway exit with the artist/title exit (native frame 198), rather than disappearing earlier.
- Godzilla: red-to-pink progress gradient on central and side screens, entry of opening artist/title from the right, earlier pill fade-in.
- Megazilla: closer artist/title/pill spacing in opening and closing copy; progress line visible within panel 05 during the photo section; front-face visibility and camera-plane clipping prevent the rotating photo's reversed back face and crossed masks from appearing over the incoming video.
- App: optional Song title colour picker, with Reset to template defaults. Six-digit hex colour is validated in Functions and the renderer and reaches all three template families. A chosen colour applies to both photo and video sections; without an override, original colours are preserved.
- Long copy: measured-font fitting remains enabled across LA, Godzilla and Megazilla. Tested the client's exact example and substantially longer strings. Uploaded artist photo/video still supply dynamic content; static assets still use the configured Storage paths.

## Local validation

- Frontend build, Functions build and renderer TypeScript check.
- Catalog consistency and manifest dry-run validation for all three templates.
- Mocked package creation: 6 LA, 7 Godzilla, 8 Megazilla jobs; uploaded URLs and selected colour preserved; invalid colour rejected; LA static in-situ emits JPG.
- Local renders with an empty bundled public directory and a local HTTP substitute for Storage. This verifies asset resolution without accessing or updating Firebase.
- Full-length flat previews for each family, 15 seconds / 30 fps / silent, plus the LA static in-situ JPG. FFprobe dimensions/frame counts/audio checks and full FFmpeg decoding.
- Stills around the Mega transition, the client's `The Dogs Are Out / Chilling by the fan / Debut Soon` example with a custom title colour, and longer text on flat, panel and social views.

The review files are under `remotion-templates/out/r2-review-2026-11-20`. They are review previews, not a new full set of all 21 delivery outputs. Native panels remain 60 fps; social remains 30 fps with the existing ambient street audio. Live authenticated app-to-VPS rendering still needs a smoke test after the user deploys both components.

## Transfer and deployment (not executed)

`R2_renderer_patch.zip` has paths relative to the renderer directory. Extract it into the existing local `remotion-templates` directory and copy the same contents into `/opt/template-stamper/remotion-templates` on the VPS. It includes `src/` and `server.js`, but no `.env`, dependencies or uploaded media. Static Storage assets have not changed.

Restart the renderer after active renders finish:

```bash
cd /opt/template-stamper/remotion-templates
pm2 restart remotion-render --update-env
curl -fsS http://127.0.0.1:8090/health
```

Wait for `bundleReady: true`. The server builds the bundle at startup.

`R2_app_functions_patch.zip` has paths relative to the app root. Extract it into the existing project on the deployment PC. Use the already repaired dependency installation; this patch does not change package versions.

```cmd
npm --prefix functions run build
node scripts/check-dooh-catalog.cjs
node scripts/check-dooh-package-creation.cjs
npm run build
node scripts/import-template-admin.cjs templates/us-dooh-la-test-v1.json --project template-stamper-mvp
node scripts/import-template-admin.cjs templates/us-dooh-ny-test-v1.json --project template-stamper-mvp
node scripts/import-template-admin.cjs templates/us-dooh-mega-test-v1.json --project template-stamper-mvp
firebase deploy --only "functions:default:createDoohPackage,functions:default:triggerRemotionRender,functions:default:onJobRequeued,functions:default:onJobCompleted,functions:default:onPendingAssetsResolved,functions:default:renderCallback,hosting" --project template-stamper-mvp
```

Create fresh packages after both deployments. Check that LA static in-situ previews/downloads as JPG, selected title colour reaches every output, and the complete ZIP includes that JPG. Existing completed files do not change automatically. This pass includes updated template JSON files (optional colour slot, version 1.1.0).

## Milestone 2

EMP remains a separate template build. The updated requirement is six outputs: 16:9 MP4 at 10s and 15s, 9:16 MP4 at 10s and 15s, and companion PNGs at 300×60 and 600×120. The old seven-output list is superseded; EMP was not implemented as part of these corrections to the existing US DOOH templates.
