import { bundle } from "@remotion/bundler";
import {
  openBrowser,
  selectComposition,
  renderStill,
  renderMedia,
} from "@remotion/renderer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

// Deliberately local: no server, cloud clients, environment secrets or uploads.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, process.env.MEGA_OUT ?? "out/megazilla-v1");
await fs.mkdir(out, { recursive: true });
const fixture = JSON.parse(
  await fs.readFile(path.join(root, "fixtures/us-dooh-app.json"), "utf8"),
);
const inputProps = {
  artistName: fixture.artistName.value,
  songTitle: fixture.songTitle.value,
  pillCopy: fixture.pillCopy.value,
  featuredArtistImage: fixture.featuredArtistImage.uri,
  featuredVideo: fixture.featuredVideo.uri,
  background: "assets/godzilla/insitu-background.png",
};
const serveUrl = process.env.MEGA_REUSE_BUNDLE
  ? path.join(out, "bundle")
  : await bundle({
      entryPoint: path.join(root, "src/index.ts"),
      publicDir: path.join(root, "public"),
      outDir: path.join(out, "bundle"),
    });
const browser = await openBrowser("chrome");
const specs = [
  ["farleft-panel01", 2352, 1666, 0, 0],
  ["centerleft-panel02", 4124, 1666, 2352, 0],
  ["centerright-panel03", 4124, 1666, 6476, 0],
  ["farright-panel04", 1952, 1666, 10600, 0],
  ["bottomcenter-panel05", 4840, 1198, 4056, 1666],
];
const compositions = {};
const probe = path.join(
  root,
  "node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe",
);
const report = [];
function validate(file, width, height, fps, audio) {
  const result = JSON.parse(
    execFileSync(
      probe,
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
      { encoding: "utf8" },
    ),
  );
  const v = result.streams.find((s) => s.codec_type === "video"),
    a = result.streams.filter((s) => s.codec_type === "audio");
  assert.equal(v.width, width);
  assert.equal(v.height, height);
  assert.equal(v.r_frame_rate, `${fps}/1`);
  assert.equal(Number(v.nb_frames), 15 * fps);
  assert.equal(a.length, audio ? 1 : 0);
  assert.equal(v.codec_name, "h264");
  assert.equal(v.pix_fmt, "yuv420p");
  assert.ok(Math.abs(Number(v.duration) - 15) <= 1 / fps);
  report.push({
    file,
    width,
    height,
    fps,
    frames: Number(v.nb_frames),
    audio: a.map((x) => ({
      codec: x.codec_name,
      channels: x.channels,
      sampleRate: x.sample_rate,
    })),
    duration: result.format.duration,
  });
}
try {
  for (const key of [
    "master",
    "flat",
    "insitu",
    "social",
    ...specs.map((p) => p[0]),
  ]) {
    const c = await selectComposition({
      serveUrl,
      id: `artist-megazilla-${key}-v1`,
      inputProps,
      puppeteerInstance: browser,
    });
    assert.equal(c.durationInFrames / c.fps, 15);
    compositions[key] = c;
  }
  console.log("PASS: all 9 Megazilla composition profiles");
  if (process.env.MEGA_STILLS) {
    for (const key of (process.env.MEGA_ONLY ?? "flat,insitu,social").split(
      ",",
    ))
      for (const frame of process.env.MEGA_STILLS.split(",").map(Number)) {
        await renderStill({
          serveUrl,
          composition: compositions[key],
          inputProps,
          puppeteerInstance: browser,
          frame,
          scale: key === "flat" ? 0.3 : 1,
          output: path.join(out, `${key}-${frame}.png`),
        });
        console.log(`STILL ${key} ${frame}`);
      }
  } else {
    for (const key of process.env.MEGA_DERIVE_ONLY
      ? []
      : (process.env.MEGA_ONLY ?? "master,insitu,social").split(",")) {
      let last = -1;
      const c = compositions[key];
      const outputLocation = path.join(out, `megazilla-${key}-${c.fps}fps.mp4`);
      await renderMedia({
        serveUrl,
        composition: c,
        inputProps,
        puppeteerInstance: browser,
        outputLocation,
        codec: "h264",
        videoBitrate: key === "master" ? "90M" : "15M",
        audioCodec: "aac",
        audioBitrate: "320k",
        muted: key !== "social",
        pixelFormat: "yuv420p",
        colorSpace: "bt709",
        concurrency: key === "master" ? 2 : 3,
        onProgress: ({ progress }) => {
          const pct = Math.floor(progress * 10) * 10;
          if (pct !== last) {
            last = pct;
            console.log(`${key}: ${pct}%`);
          }
        },
      });
      if (key === "social") {
        // Keep the supplied AAC bitstream and timestamps: avoid re-encoding delay.
        const remuxed = path.join(out, "megazilla-social-audio-copy.mp4");
        execFileSync(
          process.env.MEGA_FFMPEG ?? "C:/Portable/ffmpeg/bin/ffmpeg.exe",
          [
            "-y",
            "-v",
            "error",
            "-i",
            outputLocation,
            "-i",
            path.join(root, "public/assets/audio/ny-street-ambient.m4a"),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c",
            "copy",
            "-t",
            "15",
            "-movflags",
            "+faststart",
            remuxed,
          ],
          { stdio: "inherit" },
        );
        validate(remuxed, c.width, c.height, c.fps, true);
        report.pop();
        await fs.rename(remuxed, outputLocation);
      }
      validate(outputLocation, c.width, c.height, c.fps, key === "social");
      await fs.writeFile(
        path.join(out, "validation.json"),
        JSON.stringify(report, null, 2),
      );
    }
    const master = path.join(out, "megazilla-master-60fps.mp4");
    if (
      process.env.MEGA_DERIVE_ONLY ||
      (process.env.MEGA_ONLY ?? "master").includes("master")
    ) {
      const ffmpeg =
        process.env.MEGA_FFMPEG ?? "C:/Portable/ffmpeg/bin/ffmpeg.exe";
      for (const [key, w, h, x, y] of specs) {
        const file = path.join(out, `megazilla-${key}-60fps.mp4`);
        execFileSync(
          ffmpeg,
          [
            "-y",
            "-v",
            "error",
            "-i",
            master,
            "-vf",
            `crop=${w}:${h}:${x}:${y}`,
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-b:v",
            "15M",
            "-pix_fmt",
            "yuv420p",
            "-colorspace",
            "bt709",
            "-color_primaries",
            "bt709",
            "-color_trc",
            "bt709",
            "-threads",
            "3",
            "-movflags",
            "+faststart",
            file,
          ],
          { stdio: "inherit" },
        );
        validate(file, w, h, 60, false);
        console.log(`PASS ${key}`);
      }
      const file = path.join(out, "megazilla-flat-30fps.mp4");
      execFileSync(
        ffmpeg,
        [
          "-y",
          "-v",
          "error",
          "-i",
          master,
          "-vf",
          "scale=6276:1432,fps=30",
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-b:v",
          "15M",
          "-pix_fmt",
          "yuv420p",
          "-threads",
          "3",
          "-movflags",
          "+faststart",
          file,
        ],
        { stdio: "inherit" },
      );
      validate(file, 6276, 1432, 30, false);
    }
    await fs.writeFile(
      path.join(out, "validation.json"),
      JSON.stringify(report, null, 2),
    );
  }
} finally {
  await browser.close({ silent: true });
}
