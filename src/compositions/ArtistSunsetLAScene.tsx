import { FittedDoohText } from "../FittedDoohText";
import { doohStaticAsset, DoohFonts } from "../doohAssets";
import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import type { ArtistLAProps } from "./ArtistSunsetLA";
import measured from "./la-motion-measured.json";
import logoRefined from "./la-logo-refined.json";
import videoPlaneMeasured from "./la-video-plane-measured.json";
import videoMasks from "./la-video-mask-measured.json";
import playbarMeasured from "./la-playbar-measured.json";
import whiteNameFitted from "./la-white-name-fitted.json";
import photoRefined from "./la-photo-refined.json";
import buttonsRefined from "./la-buttons-refined.json";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const asset = (path: string) =>
  /^(https?:|data:|blob:)/.test(path) ? path : staticFile(path);
type Track = number[][];
const sample = (track: Track, frame: number) =>
  track[0].slice(1).map((_, i) =>
    interpolate(
      frame,
      track.map((row) => row[0]),
      track.map((row) => row[i + 1]),
      clamp,
    ),
  );
// A homography retains the perspective of an AE plane, including its moving vanishing point.
// Preserve its sign: entrance tracks keep visible glyphs at positive homogeneous w.
// Normalizing a negative h[8] to +1 would reveal the back of the text plane.
const matrix = (h: number[]) =>
  `matrix3d(${[h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]].join(",")})`;
const quadHomography = (p: number[], width: number, height: number) => {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = p;
  const dx1 = x1 - x2,
    dx2 = x3 - x2,
    dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2,
    dy2 = y3 - y2,
    dy3 = y0 - y1 + y2 - y3;
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  return [
    (x1 - x0 + g * x1) / width,
    (x3 - x0 + h * x3) / height,
    x0,
    (y1 - y0 + g * y1) / width,
    (y3 - y0 + h * y3) / height,
    y0,
    g / width,
    h / height,
    1,
  ];
};
const plane: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: 2304,
  height: 936,
  transformOrigin: "0 0",
};
const normalizeName = (row: number[]) => {
  const h = row.slice(1);
  const front = h[6] * 530 + h[7] * 125 + h[8];
  return [row[0], ...h.map((value) => value / front)];
};
const firstName = whiteNameFitted[0].slice(1);
const firstVisibleName = [
  317,
  1.3 * firstName[0] - 198 * firstName[6],
  1.3 * firstName[1] - 198 * firstName[7],
  1.3 * firstName[2] - 198 * firstName[8],
  1.15 * firstName[3] - 53 * firstName[6],
  1.15 * firstName[4] - 53 * firstName[7],
  1.15 * firstName[5] - 53 * firstName[8],
  firstName[6],
  firstName[7],
  firstName[8],
];
const videoArtistEntry: Track = [firstVisibleName, ...whiteNameFitted].map(
  normalizeName,
);
// Interpolate projective coefficients, not projected corners crossing a vanishing point.
const photoMotion: Track = photoRefined.map((row) => [
  row[0],
  ...quadHomography(row.slice(1), 1615, 975),
]);

const UI: React.FC<{ frame: number; photo?: boolean }> = ({ frame, photo }) => {
  const progress = photo
    ? 56 + (frame / 60) * 1.1
    : 47.6 + (frame / 60 - 5.8) * 1.6;
  return (
    <div
      style={{
        position: "absolute",
        left: photo ? 310 : 55,
        right: photo ? 100 : 95,
        bottom: photo ? 85 : 115,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: photo ? "flex-start" : "flex-end",
          gap: 20,
          marginBottom: 22,
        }}
      >
        <Img
          src={doohStaticAsset("assets/la-sunset/like.png")}
          style={{ height: photo ? 66 : 98 }}
        />
        <Img
          src={doohStaticAsset("assets/la-sunset/subscribe.png")}
          style={{ height: photo ? 66 : 98 }}
        />
      </div>
      <div
        style={{
          height: 14,
          background: "#ffffff33",
          position: "relative",
          opacity: photo ? 1 : 0,
        }}
      >
        <div
          style={{
            height: 14,
            width: `${progress}%`,
            background: "linear-gradient(90deg, #ff0033 0%, #ff2a9b 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${progress}%`,
            top: -10,
            width: 34,
            height: 34,
            marginLeft: -17,
            borderRadius: "50%",
            background: "#ff0033",
          }}
        />
      </div>
    </div>
  );
};

const TextPlane: React.FC<{
  track: Track;
  frame: number;
  start: number;
  settle?: boolean;
  children: React.ReactNode;
}> = ({ track, frame, start, settle = false, children }) => {
  if (frame < start || track.length === 0) return null;
  const h = sample(track, frame);
  let transform = matrix(h);
  if (settle && frame >= 370) {
    // The entrance has ended. Remove the residual measured perspective so
    // Chrome cannot keep a different glyph raster scale on each render worker.
    // The local affine approximation preserves position and scale at the copy center.
    const x = 350,
      y = 180;
    const w = h[6] * x + h[7] * y + h[8];
    const u = (h[0] * x + h[1] * y + h[2]) / w;
    const v = (h[3] * x + h[4] * y + h[5]) / w;
    const a = (h[0] - u * h[6]) / w;
    const c = (h[1] - u * h[7]) / w;
    const b = (h[3] - v * h[6]) / w;
    const d = (h[4] - v * h[7]) / w;
    const e = u - a * x - c * y;
    const f = v - b * x - d * y;
    const affine = [a, c, e, b, d, f, 0, 0, 1];
    const mix = interpolate(frame, [370, 382], [0, 1], clamp);
    transform =
      frame >= 382
        ? `matrix(${a},${b},${c},${d},${e},${f})`
        : matrix(
            h.map((value, i) => (value / w) * (1 - mix) + affine[i] * mix),
          );
  }
  return <div style={{ ...plane, transform }}>{children}</div>;
};

const Copy: React.FC<{
  props: ArtistLAProps;
  frame: number;
  video?: boolean;
}> = ({ props, frame, video = false }) => {
  const left = video ? 85 : 1407;
  const top = video ? 40 : 15;
  const scale = video ? 0.82 : 1;
  const artistTrack = video ? videoArtistEntry : measured.artist;
  const titleTrack = video ? measured.videoTitle : measured.title;
  const pillTrack = video ? measured.videoPill : measured.pill;
  const style: React.CSSProperties = {
    position: "absolute",
    left,
    whiteSpace: "pre-line",
    lineHeight: 1,
    transformOrigin: "top left",
    transform: `scale(${scale})`,
    color: video ? "white" : "#202020",
  };
  return (
    <>
      <TextPlane
        track={artistTrack}
        frame={frame}
        start={video ? 317 : 24}
        settle={video}
      >
        <FittedDoohText
          text={props.artistName}
          prefix="LA"
          family="LAExtra"
          baseSize={172}
          maxWidth={850}
          maxHeight={props.artistName.includes("\n") ? 136 : 172}
          style={{ ...style, top }}
        />
      </TextPlane>
      <TextPlane
        track={titleTrack}
        frame={frame}
        start={video ? 339 : 41}
        settle={video}
      >
        <FittedDoohText
          text={props.songTitle}
          prefix="LA"
          family="LABold"
          baseSize={160}
          maxWidth={850}
          maxHeight={160}
          style={{
            ...style,
            top: top + 136 * scale,
            fontFamily: "LABold",
            fontSize: 160,
            color: props.songTitleColor ?? (video ? "white" : "#142467"),
            opacity: interpolate(
              frame,
              video ? [338, 342] : [40, 44],
              [0, 1],
              clamp,
            ),
          }}
        />
      </TextPlane>
      <TextPlane track={pillTrack} frame={frame} start={video ? 346 : 48}>
        <FittedDoohText
          text={props.pillCopy}
          prefix="LA"
          family="LARoboto"
          baseSize={46}
          maxWidth={780}
          maxHeight={46}
          style={{
            ...style,
            top: top + 340 * scale,
            display: "inline-block",
            fontFamily: "LARoboto",
            fontSize: 46,
            border: "6px solid currentColor",
            padding: "18px 29px",
            opacity: interpolate(
              frame,
              video ? [346, 348] : [48, 50],
              [0, 1],
              clamp,
            ),
            borderRadius: 18,
          }}
        />
      </TextPlane>
    </>
  );
};

// AE animates the footage, frame matte and player graphics separately.
// Keep these as independent vector tracks rather than stretching the whole player.
export const ArtistSunsetLAScene: React.FC<ArtistLAProps> = (props) => {
  const { fps } = useVideoConfig();
  // The delivered AE sequence has distinct 60 FPS poses, including odd frames.
  // In-situ at 30 FPS samples the same timeline at every second master frame.
  const frame = (useCurrentFrame() * 60) / fps;
  // R2: hold until the measured artist/title exit begins at master frame 198.
  // Use the master timeline so 30 fps InSitu and 60 fps exports stay aligned.
  const logoExit = interpolate(frame, [198, 250], [0, 1], clamp);
  const logoExitX =
    -18 * Math.sin(2 * Math.PI * logoExit) * Math.sin(Math.PI * logoExit);
  const logoExitY = 160 * logoExit * logoExit;
  const progressGradientId = React.useId().replace(/:/g, "");
  const maskPoints = (videoMasks as Record<string, number[][]>)[
    Math.min(frame, 350)
  ];
  const videoClip = maskPoints
    ? `polygon(${maskPoints.map(([x, y]) => `${x}px ${y}px`).join(",")})`
    : "polygon(0 0,0 0,0 0)";
  const [barX, barY, dotX, dotY] = sample(playbarMeasured, frame);
  const finalLogoH = sample(logoRefined, frame);
  const filled = interpolate(
    frame,
    [268, 276, 286, 300, 350, 898],
    [0.83, 0.78, 0.65, 0.46, 0.48, 0.56],
    clamp,
  );
  return (
    <AbsoluteFill style={{ background: "#fff", overflow: "hidden" }}>
      <DoohFonts prefix="LA" />
      {frame < 304 && (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 1615,
              height: 975,
              borderRadius: 52,
              overflow: "hidden",
              transformOrigin: "0 0",
              transform: matrix(sample(photoMotion, frame)),
            }}
          >
            <Img
              src={asset(props.featuredArtistImage)}
              style={{
                position: "absolute",
                width: 3919.7,
                height: 2204.8,
                left: -1206.8,
                top: -616,
                objectFit: "cover",
              }}
            />
            <UI frame={frame} photo />
          </div>
          {frame < 264 && <Copy props={props} frame={frame} />}
          {frame < 250 && (
            <Img
              src={doohStaticAsset("assets/la-sunset/logo-black.png")}
              style={{
                position: "absolute",
                left: 1770,
                top: 770,
                width: 550,
                transform: `translate(${logoExitX}px, ${logoExitY}px)`,
              }}
            />
          )}
        </>
      )}
      {/* Preserve the AE footage in-point (4.15 s), including its half-source-frame phase. */}
      <Sequence from={Math.round((249 / 60) * fps)}>
        <div style={{ ...plane, clipPath: videoClip, background: "#111" }}>
          <OffthreadVideo
            src={asset(props.featuredVideo)}
            muted
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 1280,
              height: 720,
              objectFit: "cover",
              transformOrigin: "0 0",
              transform: matrix(sample(videoPlaneMeasured, frame)),
              filter: "brightness(.82)",
            }}
          />
          <div
            style={{
              ...plane,
              transform: matrix(sample(buttonsRefined, frame)),
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -40,
                top: -80,
                width: 2280,
                height: 990,
                borderRadius: 65,
                overflow: "hidden",
              }}
            >
              <UI frame={frame} />
            </div>
          </div>
          <div style={{ ...plane, transform: matrix(finalLogoH) }}>
            <Img
              src={doohStaticAsset("assets/la-sunset/logo-white.png")}
              style={{ position: "absolute", left: 1552, top: 3, width: 690 }}
            />
          </div>
          {frame >= playbarMeasured[0][0] && (
            <svg
              width={2304}
              height={936}
              style={{ position: "absolute", left: 0, top: 0 }}
            >
              <defs>
                <linearGradient
                  id={progressGradientId}
                  gradientUnits="userSpaceOnUse"
                  x1={barX}
                  y1={barY}
                  x2={dotX}
                  y2={dotY}
                >
                  <stop offset="0%" stopColor="#ff0033" />
                  <stop offset="100%" stopColor="#ff2a9b" />
                </linearGradient>
              </defs>
              <line
                x1={barX}
                y1={barY}
                x2={barX + (dotX - barX) / filled}
                y2={barY + (dotY - barY) / filled}
                stroke="#ffffff33"
                strokeWidth={14}
              />
              <line
                x1={barX}
                y1={barY}
                x2={dotX}
                y2={dotY}
                stroke={`url(#${progressGradientId})`}
                strokeWidth={14}
              />
              <circle cx={dotX} cy={dotY} r={20} fill="#ff0033" />
            </svg>
          )}
        </div>
      </Sequence>
      <Copy props={props} frame={frame} video />
    </AbsoluteFill>
  );
};
