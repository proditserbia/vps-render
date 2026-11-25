import { doohStaticAsset } from "../doohAssets";
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ArtistSunsetLA, type ArtistLAProps } from "./ArtistSunsetLA";
import { GodzillaSocialRight, GodzillaSocialCenter } from "./ArtistGodzilla";
import tracking from "../data/social-tracking.json";

type Point = number[];
type Transform = [Point, Point, Point, number];
type Track = [Transform, Transform, Point[], Point[], Transform];
const plane: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  transformOrigin: "0 0",
};

// Map a rectangular creative onto the four tracked corners of the physical screen.
function project(width: number, height: number, points: Point[]) {
  const src = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ];
  const a: number[][] = [];
  src.forEach(([x, y], i) => {
    const [u, v] = points[i];
    a.push(
      [x, y, 1, 0, 0, 0, -u * x, -u * y, u],
      [0, 0, 0, x, y, 1, -v * x, -v * y, v],
    );
  });
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++)
      if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    const d = a[c][c];
    for (let j = c; j < 9; j++) a[c][j] /= d;
    for (let r = 0; r < 8; r++)
      if (r !== c) {
        const m = a[r][c];
        for (let j = c; j < 9; j++) a[r][j] -= m * a[c][j];
      }
  }
  const h = a.map((r) => r[8]);
  return `matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,1)`;
}
function transformPoint(
  p: Point,
  [anchor, pos, scale, rotation]: Transform,
): Point {
  const x = ((p[0] - anchor[0]) * scale[0]) / 100,
    y = ((p[1] - anchor[1]) * scale[1]) / 100,
    r = (rotation * Math.PI) / 180;
  return [
    pos[0] + x * Math.cos(r) - y * Math.sin(r),
    pos[1] + x * Math.sin(r) + y * Math.cos(r),
  ];
}
const Surface: React.FC<{
  width: number;
  height: number;
  corners: Point[];
  children: React.ReactNode;
}> = ({ width, height, corners, children }) => (
  <div
    style={{
      ...plane,
      width,
      height,
      overflow: "hidden",
      transform: project(width, height, corners),
    }}
  >
    {children}
  </div>
);

export const StreetSocial: React.FC<{
  family: "la" | "ny";
  props: ArtistLAProps;
}> = ({ family, props }) => {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  const index = Math.min(449, Math.round((frame * 30) / fps));
  const [la, ny, front, side, sideTransform] = tracking[index] as Track;
  const [anchor, pos, scale, rotation] = family === "la" ? la : ny;
  const brandFrame = index;
  return (
    <AbsoluteFill style={{ background: "black", overflow: "hidden" }}>
      <Audio
        src={doohStaticAsset(`assets/audio/${family}-street-ambient.m4a`)}
      />
      <div
        style={{
          ...plane,
          width: family === "la" ? 2160 : 4096,
          height: family === "la" ? 3840 : 2304,
          transform: `translate(${pos[0]}px,${pos[1]}px) rotate(${rotation}deg) scale(${scale[0] / 100},${scale[1] / 100}) translate(${-anchor[0]}px,${-anchor[1]}px)`,
        }}
      >
        <OffthreadVideo
          muted
          src={doohStaticAsset(`assets/social/${family}-street.mp4`)}
          style={{ ...plane, width: "100%", height: "100%" }}
        />
        {family === "la" ? (
          <Surface
            width={2304}
            height={936}
            corners={[
              [684.75, 705],
              [1562, 873.75],
              [693.25, 1221],
              [1576.25, 1336.25],
            ]}
          >
            <ArtistSunsetLA {...props} />
          </Surface>
        ) : (
          <>
            <Surface width={8248} height={2864} corners={front}>
              <GodzillaSocialCenter {...props} />
            </Surface>
            <Surface
              width={1952}
              height={1666}
              corners={side.map((p) => transformPoint(p, sideTransform))}
            >
              <GodzillaSocialRight {...props} />
            </Surface>
          </>
        )}
      </div>
      {(brandFrame <= 45 || brandFrame >= 360) && (
        <Img
          src={doohStaticAsset(
            `assets/social/branding/${String(brandFrame).padStart(3, "0")}.png`,
          )}
          style={{ ...plane, width: 1080, height: 1920 }}
        />
      )}
    </AbsoluteFill>
  );
};
