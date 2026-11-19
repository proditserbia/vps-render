import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import storage from "./dooh-storage.json";

/** Fixed template assets follow the existing Veo/Effects Firebase URL pattern.
 * Never call this on uploaded artist media: their download URLs remain unchanged.
 */
export function doohStaticAsset(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  if (!path.startsWith("assets/") || path.split("/").includes("..")) {
    throw new Error(`Invalid DOOH static asset path: ${path}`);
  }
  return `${storage.origin}/v0/b/${storage.bucket}/o/${encodeURIComponent(`${storage.prefix}/${path}`)}?alt=media`;
}

const files = [
  "YouTubeDisplay-ExtraBold.ttf",
  "YouTubeDisplay-Bold.ttf",
  "Roboto-Medium.ttf",
];
const loaded = new Map<string, Promise<FontFace>>();

/** Wait for remote fonts before capturing frames, as in the existing templates. */
export function DoohFonts({ prefix }: { prefix: "LA" | "Godz" | "Mega" }) {
  const [handle] = useState(() =>
    delayRender(`Loading ${prefix} Storage fonts`),
  );
  useEffect(() => {
    let active = true;
    const requests = ["Extra", "Bold", "Roboto"].map((suffix, i) => {
      const family = `${prefix}${suffix}`;
      let request = loaded.get(family);
      if (!request) {
        request = new FontFace(
          family,
          `url("${doohStaticAsset(`assets/fonts/${files[i]}`)}")`,
        )
          .load()
          .then((font) => {
            document.fonts.add(font);
            return font;
          });
        loaded.set(family, request);
      }
      return request;
    });
    Promise.all(requests)
      .then(() => {
        if (active) continueRender(handle);
      })
      .catch((error) => {
        if (active) cancelRender(error);
      });
    return () => {
      active = false;
      continueRender(handle);
    };
  }, [handle, prefix]);
  return null;
}
