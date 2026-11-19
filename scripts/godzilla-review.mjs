import { bundle } from "@remotion/bundler";
import {
  getCompositions,
  renderStill,
  renderMedia,
  openBrowser,
} from "@remotion/renderer";
import fs from "node:fs/promises";
import path from "node:path";
const cwd = process.cwd();
const mode = process.argv[2] ?? "stills";
const props = JSON.parse(
  await fs.readFile(path.join(cwd, "fixtures/artist-godzilla.json"), "utf8"),
);
const output = path.join(cwd, "out/godzilla-v10");
await fs.mkdir(output, { recursive: true });
const browserExecutable =
  process.env.GODZILLA_BROWSER ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const serveUrl = await bundle({
  entryPoint: path.join(cwd, "src/index.ts"),
  enableCaching: false,
});
const browser = await openBrowser("chrome", { browserExecutable });
try {
  const comps = await getCompositions(serveUrl, {
    inputProps: props,
    puppeteerInstance: browser,
  });
  const get = (id) => {
    const c = comps.find((c) => c.id === id);
    if (!c) throw Error(`Missing ${id}`);
    return c;
  };
  if (mode === "baseline") {
    for (const frame of process.env.GODZILLA_FRAMES?.split(",").map(Number) ?? [
      274,
    ]) {
      for (const [version, label] of [
        [9, "baseline"],
        [10, "control"],
      ]) {
        await renderStill({
          serveUrl,
          composition: get(`artist-godzilla-flat-v${version}`),
          inputProps: props,
          frame,
          output: path.join(output, `${label}-v${version}-${frame}.png`),
          puppeteerInstance: browser,
        });
      }
    }
  } else if (mode === "insitu-still") {
    for (const frame of [180, 240, 270, 310, 360, 420]) {
      await renderStill({
        serveUrl,
        composition: get("artist-godzilla-insitu-v10"),
        inputProps: props,
        frame,
        output: path.join(output, `insitu-${frame}.png`),
        puppeteerInstance: browser,
      });
      console.log("InSitu still", frame);
    }
  } else if (mode === "stills") {
    for (const frame of process.env.GODZILLA_FRAMES?.split(",").map(Number) ?? [
      180, 220, 240, 246, 250, 260, 270, 308, 310, 315, 320, 330, 360,
    ]) {
      await renderStill({
        serveUrl,
        composition: get("artist-godzilla-flat-v10"),
        inputProps: props,
        frame,
        output: path.join(output, `flat-${frame}.png`),
        puppeteerInstance: browser,
      });
      console.log("Still", frame);
    }
    await renderStill({
      serveUrl,
      composition: get("artist-godzilla-insitu-v10"),
      inputProps: props,
      frame: 420,
      output: path.join(output, "insitu-420.png"),
      puppeteerInstance: browser,
    });
  } else if (mode === "video" || mode === "insitu") {
    const ids =
      mode === "insitu"
        ? ["artist-godzilla-insitu-v10"]
        : ["artist-godzilla-flat-v10", "artist-godzilla-insitu-v10"];
    for (const id of ids) {
      await renderMedia({
        serveUrl,
        composition: get(id),
        inputProps: props,
        codec: "h264",
        videoBitrate: id.includes("flat") ? "25M" : "12M",
        muted: true,
        concurrency: id.includes("insitu") ? 1 : 4,
        outputLocation: path.join(
          output,
          id.includes("flat")
            ? "Artist_Godzilla_Flat_v10.mp4"
            : "Artist_Godzilla_InSitu_v10.mp4",
        ),
        puppeteerInstance: browser,
        onProgress: ({ progress }) => {
          const pct = Math.floor(progress * 100);
          if (pct % 10 === 0 && pct !== globalThis.lastPct) {
            globalThis.lastPct = pct;
            console.log(id, pct + "%");
          }
        },
      });
    }
  } else if (mode === "panels") {
    // Compare panel joins with the native master; browser sampling may differ slightly.
    for (const c of comps.filter(
      (c) =>
        c.id.includes("godzilla-") &&
        c.id.endsWith("-v10") &&
        (c.id.includes("panel") || c.id.includes("master")),
    )) {
      await renderStill({
        serveUrl,
        composition: c,
        inputProps: { ...c.defaultProps, ...props },
        frame: 420,
        output: path.join(output, `${c.id}-420.png`),
        puppeteerInstance: browser,
      });
      console.log("Panel check", c.id);
    }
  } else {
    throw Error("Use stills, insitu-still, video, insitu or panels");
  }
} finally {
  await browser.close({ silent: true });
}
