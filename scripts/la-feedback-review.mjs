import { bundle } from "@remotion/bundler";
import {
  selectComposition,
  openBrowser,
  renderMedia,
  renderStill,
} from "@remotion/renderer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Local-only review: no Firebase or render-server requests.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shortReview = Boolean(process.env.LA_REVIEW_SHORT);
const output = path.join(
  root,
  "out/la-sunset-feedback-nov13-stable-text",
  ...(shortReview ? ["short-check"] : []),
);
const props = JSON.parse(
  await fs.readFile(path.join(root, "fixtures/artist-la.json"), "utf8"),
);
await fs.mkdir(output, { recursive: true });
const serveUrl = await bundle({
  entryPoint: path.join(root, "src/index.ts"),
  publicDir: path.join(root, "public"),
  outDir: path.join(output, "bundle"),
});
const browser = await openBrowser("chrome", {
  browserExecutable: process.env.REMOTION_BROWSER,
});
try {
  for (const [id, name] of [
    ["artist-sunset-la-v1", "LA_Sunset_Flat_feedback"],
    ["artist-sunset-la-insitu-v1", "LA_Sunset_InSitu_feedback"],
  ]) {
    const composition = await selectComposition({
      serveUrl,
      id,
      inputProps: props,
      puppeteerInstance: browser,
    });
    if (id === "artist-sunset-la-v1" && !shortReview) {
      for (const frame of [180, 198, 215, 233, 249, 340, 350, 370, 420]) {
        await renderStill({
          serveUrl,
          composition,
          inputProps: props,
          frame,
          output: path.join(output, `flat-${frame}.png`),
          puppeteerInstance: browser,
        });
      }
    }
    let lastPct = -1;
    await renderMedia({
      serveUrl,
      composition,
      inputProps: props,
      codec: "h264",
      videoBitrate: id === "artist-sunset-la-v1" ? "40M" : "15M",
      pixelFormat: "yuv420p",
      colorSpace: "bt709",
      muted: true,
      concurrency: 4,
      ...(shortReview
        ? {
            frameRange: [
              Math.round(5 * composition.fps),
              Math.round(7.5 * composition.fps) - 1,
            ],
          }
        : {}),
      outputLocation: path.join(output, `${name}.mp4`),
      puppeteerInstance: browser,
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 10) * 10;
        if (pct !== lastPct) {
          lastPct = pct;
          console.log(`${name}: ${pct}%`);
        }
      },
    });
    console.log(
      `Finished ${name}: ${composition.width}x${composition.height}, ${composition.fps} fps, ${shortReview ? 2.5 * composition.fps : composition.durationInFrames} frames`,
    );
  }
} catch (error) {
  console.error("Render failed:", error);
  process.exitCode = 1;
} finally {
  await browser.close({ silent: true }).catch(() => {});
}
