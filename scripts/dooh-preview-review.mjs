import { bundle } from "@remotion/bundler";
import {
  openBrowser,
  selectComposition,
  renderMedia,
  renderStill,
} from "@remotion/renderer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

// Local assets only. Does not load server.js, .env or Firebase credentials.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(
  root,
  process.env.DOOH_REVIEW_OUT ?? "out/dooh-previews-30fps-ambient",
);
const catalog = JSON.parse(
  await fs.readFile(path.join(root, "src/usDoohOutputs.json"), "utf8"),
);
const base = JSON.parse(
  await fs.readFile(path.join(root, "fixtures/us-dooh-app.json"), "utf8"),
);
await fs.mkdir(out, { recursive: true });
const serveUrl = await bundle({
  entryPoint: path.join(root, "src/index.ts"),
  publicDir: path.join(root, "public"),
  outDir: path.join(out, "bundle"),
});
const browser = await openBrowser("chrome", {
  browserExecutable: process.env.REMOTION_BROWSER,
});
const probe =
  process.env.FFPROBE_PATH ??
  path.join(
    root,
    "node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe",
  );
const report = [];
try {
  // Check all 13 profiles, including masters that must remain 60 fps.
  for (const family of ["la", "ny"]) {
    for (const [variant, spec] of Object.entries(catalog[family])) {
      const inputProps = { ...base, outputVariant: variant };
      const id = `us-dooh-${family}-test-v1`;
      const composition = await selectComposition({
        serveUrl,
        id,
        inputProps,
        puppeteerInstance: browser,
      });
      for (const key of ["width", "height", "fps", "durationInFrames"])
        assert.equal(
          composition[key],
          spec[key],
          `${family}/${variant}/${key}`,
        );
      assert.equal(composition.durationInFrames / composition.fps, 15);
      if (!["flat", "insitu", "static-insitu", "social"].includes(variant))
        continue;
      assert.equal(composition.fps, 30);
      const key = `${family}-${variant}`;
      if (
        process.env.DOOH_REVIEW_ONLY &&
        !process.env.DOOH_REVIEW_ONLY.split(",").includes(key)
      )
        continue;
      const outputLocation = path.join(out, `${key}-30fps.mp4`);
      if (process.env.DOOH_REVIEW_PREFLIGHT) {
        await renderStill({
          serveUrl,
          composition,
          inputProps,
          frame: 90,
          output: path.join(out, `${key}-90.png`),
          puppeteerInstance: browser,
        });
        console.log(`PREFLIGHT ${key}: frame 90`);
      }
      if (process.env.DOOH_REVIEW_STILLS) {
        for (const frame of process.env.DOOH_REVIEW_STILLS.split(",").map(
          Number,
        )) {
          await renderStill({
            serveUrl,
            composition,
            inputProps,
            frame,
            output: path.join(out, `${key}-${frame}.png`),
            puppeteerInstance: browser,
          });
          console.log(`STILL ${key}: ${frame}`);
        }
        continue;
      }
      let last = -1;
      await renderMedia({
        serveUrl,
        composition,
        inputProps,
        outputLocation,
        puppeteerInstance: browser,
        codec: "h264",
        videoBitrate: "15M",
        audioCodec: "aac",
        audioBitrate: "320k",
        pixelFormat: "yuv420p",
        colorSpace: "bt709",
        muted: spec.audio !== "ambient",
        concurrency: 4,
        onProgress: ({ progress }) => {
          const pct = Math.floor(progress * 10) * 10;
          if (pct !== last) {
            last = pct;
            console.log(`${key}: ${pct}%`);
          }
        },
      });
      await renderStill({
        serveUrl,
        composition,
        inputProps,
        frame: 210,
        output: path.join(out, `${key}-7s.png`),
        puppeteerInstance: browser,
      });
      const metadata = JSON.parse(
        execFileSync(
          probe,
          [
            "-v",
            "error",
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            outputLocation,
          ],
          { encoding: "utf8" },
        ),
      );
      const video = metadata.streams.find((s) => s.codec_type === "video");
      const audio = metadata.streams.filter((s) => s.codec_type === "audio");
      assert.equal(video.r_frame_rate, "30/1");
      assert.equal(Number(video.nb_frames), 450);
      assert.equal(video.width, spec.width);
      assert.equal(video.height, spec.height);
      assert.ok(Math.abs(Number(metadata.format.duration) - 15) < 0.1);
      assert.equal(
        audio.length,
        spec.audio === "ambient" ? 1 : 0,
        `${key} audio policy`,
      );
      report.push({
        key,
        file: outputLocation,
        width: video.width,
        height: video.height,
        fps: 30,
        frames: 450,
        duration: metadata.format.duration,
        audio: audio.map((s) => ({
          codec: s.codec_name,
          channels: s.channels,
          sampleRate: s.sample_rate,
        })),
      });
      await fs.writeFile(
        path.join(out, "validation.json"),
        JSON.stringify(report, null, 2),
      );
      console.log(
        `PASS ${key}: 30 fps, 450 frames, ${audio.length ? "ambient audio" : "no audio track"}`,
      );
    }
  }
} finally {
  await browser.close({ silent: true });
}
