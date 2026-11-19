import {
  openBrowser,
  selectComposition,
  renderStill,
} from "@remotion/renderer";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const out = path.resolve("out/megazilla-v1");
const serveUrl = path.join(out, "bundle");
const fixture = JSON.parse(
  await fs.readFile("fixtures/us-dooh-app.json", "utf8"),
);
const manifest = JSON.parse(
  await fs.readFile("../templates/us-dooh-mega-test-v1.json", "utf8"),
);
const expected = {
  flat: [6276, 1432, 30],
  insitu: [1920, 1080, 30],
  panel01: [2352, 1666, 60],
  panel02: [4124, 1666, 60],
  panel03: [4124, 1666, 60],
  panel04: [1952, 1666, 60],
  panel05: [4840, 1198, 60],
  social: [1080, 1920, 30],
};
assert.deepEqual(
  manifest.slots
    .find((s) => s.slotId === "outputVariant")
    .options.map((o) => o.value),
  Object.keys(expected),
);
const browser = await openBrowser("chrome");
const options = {
  serveUrl,
  id: "us-dooh-mega-test-v1",
  puppeteerInstance: browser,
};
try {
  for (const [outputVariant, [w, h, fps]] of Object.entries(expected)) {
    const c = await selectComposition({
      ...options,
      inputProps: { ...fixture, outputVariant },
    });
    assert.deepEqual(
      [c.width, c.height, c.fps, c.durationInFrames],
      [w, h, fps, fps * 15],
    );
  }
  await assert.rejects(
    () =>
      selectComposition({
        ...options,
        inputProps: { ...fixture, outputVariant: "__proto__" },
      }),
    /Unsupported/,
  );
  await assert.rejects(
    () =>
      selectComposition({
        ...options,
        inputProps: { ...fixture, artistName: { type: "text", value: "" } },
      }),
    /Invalid artistName/,
  );
  await assert.rejects(
    () =>
      selectComposition({
        ...options,
        inputProps: {
          ...fixture,
          featuredVideo: { ...fixture.featuredVideo, trim_start_seconds: 2 },
        },
      }),
    /trim offsets/,
  );
  const inputProps = {
    ...fixture,
    artistName: { type: "text", value: "SECOND ARTIST" },
    songTitle: { type: "text", value: "ANOTHER SONG" },
    pillCopy: { type: "text", value: "New Album" },
  };
  const c = await selectComposition({ ...options, inputProps });
  await renderStill({
    ...options,
    composition: c,
    inputProps,
    frame: 210,
    scale: 0.3,
    output: path.join(out, "alternate-inputs.png"),
  });
  await fs.writeFile(
    path.join(out, "template-validation.json"),
    JSON.stringify(
      {
        profiles: expected,
        manifestMatches: true,
        invalidInputsRejected: true,
        alternateCopyRendered: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: 8 app outputs, manifest, invalid input rejection, alternate copy.",
  );
} finally {
  await browser.close({ silent: true });
}
