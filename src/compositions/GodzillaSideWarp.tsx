import React, { useId } from "react";
import maps from "./godzilla-side-warp.json";

/** Residual lens geometry in world coordinates; UI and center are excluded. */
export const GodzillaSideWarp: React.FC<{
  side: "left" | "right";
  frame: number;
  width: number;
  children: React.ReactNode;
}> = ({ side, frame, width, children }) => {
  const id = `godzilla-lens-${useId().replace(/:/g, "")}`;
  const rows = maps[side];
  const next = rows.findIndex((row) => row.frame >= frame);
  const b = rows[next < 0 ? rows.length - 1 : next];
  const a = rows[Math.max(0, (next < 0 ? rows.length - 1 : next) - 1)];
  const t = Math.max(
    0,
    Math.min(1, (frame - a.frame) / (b.frame - a.frame || 1)),
  );
  const end = side === "left" ? 280 : 284;
  const gain = Math.max(
    0,
    Math.min(1, (frame - 246) / 4, (end - frame) / (end - 278)),
  );
  return (
    <>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <filter
            id={id}
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            x={-64}
            y={-64}
            width={width + 128}
            height={962}
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={a.map}
              x={0}
              y={0}
              width={width}
              height={834}
              preserveAspectRatio="none"
              result="a"
            />
            <feImage
              href={b.map}
              x={0}
              y={0}
              width={width}
              height={834}
              preserveAspectRatio="none"
              result="b"
            />
            <feComposite
              in="a"
              in2="b"
              operator="arithmetic"
              k2={1 - t}
              k3={t}
              result="blend"
            />
            <feComponentTransfer in="blend" result="map">
              <feFuncR type="linear" slope={1} intercept={-0.5 / 255} />
              <feFuncG type="linear" slope={1} intercept={-0.5 / 255} />
            </feComponentTransfer>
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={80 * gain}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          width,
          height: 834,
          filter: `url(#${id})`,
        }}
      >
        {children}
      </div>
    </>
  );
};
