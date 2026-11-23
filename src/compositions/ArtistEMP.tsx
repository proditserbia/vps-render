import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import outputs from "../empOutputs.json";
import geometry from "../data/emp-geometry.json";
import { homography, matrix, rowAt } from "./megaProjection";
import { DoohFonts, doohStaticAsset } from "../doohAssets";
import { FittedDoohText } from "../FittedDoohText";

type Variant = keyof typeof outputs;
type Slot = string | { type?: string; value?: string; uri?: string };
export type EmpInput = {
  outputVariant?: string;
  [key: string]: Slot | undefined;
};
type Copy = {
  artistName: string;
  songTitle: string;
  pillCopy: string;
  verticalArtist: string;
  verticalTitle: string;
  featuredArtistImage: string;
  featuredVideo: string;
  songTitleColor: string;
  textColor: string;
  videoTextColor: string;
  bannerColor: string;
  bannerTextColor: string;
  backgroundColor: string;
  fullAudio10: string;
  fullAudio15: string;
  artistLiner: string;
};
const read = (p: EmpInput, key: string, fallback = "") => {
  const v = p[key];
  return (typeof v === "string" ? v : (v?.value ?? v?.uri ?? fallback)).trim();
};
export function resolveEmp(p: EmpInput): Copy {
  const result: Record<string, string> = {};
  for (const key of [
    "artistName",
    "songTitle",
    "pillCopy",
    "featuredArtistImage",
    "featuredVideo",
  ]) {
    result[key] = read(p, key);
    if (!result[key]) throw new Error(`EMP requires ${key}`);
  }
  for (const key of ["artistName", "songTitle", "pillCopy"])
    if (result[key].length > 160) throw new Error(`${key} is too long`);
  for (const [key, fallback] of Object.entries({
    songTitleColor: "#ff8732",
    textColor: "#ffffff",
    videoTextColor: "#ffffff",
    bannerColor: "#ff8732",
    bannerTextColor: "#ffffff",
    backgroundColor: "#ffffff",
  })) {
    result[key] = read(p, key, fallback);
    if (!/^#[0-9a-f]{6}$/i.test(result[key])) throw new Error(`Invalid ${key}`);
  }
  for (const key of [
    "verticalArtist",
    "verticalTitle",
    "fullAudio10",
    "fullAudio15",
    "artistLiner",
  ])
    result[key] = read(p, key);
  for (const key of ["verticalArtist", "verticalTitle"])
    if (result[key].length > 160) throw new Error(`${key} is too long`);
  return result as Copy;
}
export const empDefaults: EmpInput = {
  artistName: "Gracie Abrams",
  songTitle: "Look at My Life",
  pillCopy: "New Song",
  featuredArtistImage: "assets/emp/artist.jpg",
  featuredVideo: "assets/emp/video.mp4",
  outputVariant: "landscape-15",
};
const src = (value: string) =>
  /^(https?:|data:|blob:)/.test(value) ? value : staticFile(value);
const pos: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  transformOrigin: "0 0",
};
const Logo: React.FC<{
  x: number;
  y: number;
  width: number;
  color?: string;
}> = ({ x, y, width, color = "#000000" }) => {
  const asset = doohStaticAsset("assets/la-sunset/logo-black.png");
  const style: React.CSSProperties = {
    position: "absolute",
    left: x - (width * 195) / 1243,
    top: y - (width * 136) / 1243,
    width: (width * 1636) / 1243,
  };
  return (
    <>
      <Img src={asset} style={style} />
      <div
        style={{
          ...style,
          height: (width * 550) / 1243,
          background: color,
          maskImage: `url("${asset}")`,
          WebkitMaskImage: `url("${asset}")`,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
          clipPath: "inset(0 0 0 39%)",
        }}
      />
    </>
  );
};
const Fit: React.FC<{
  text: string;
  size: number;
  width: number;
  height: number;
  bold?: boolean;
  style?: React.CSSProperties;
}> = ({ text, size, width, height, bold, style }) => (
  <FittedDoohText
    text={text}
    prefix="Mega"
    family={bold ? "MegaExtra" : "MegaBold"}
    baseSize={size}
    maxWidth={width}
    maxHeight={height}
    style={style ?? {}}
  />
);

const CopyBlock: React.FC<{
  copy: Copy;
  vertical: boolean;
  video: boolean;
  opacity: number;
}> = ({ copy, vertical, video, opacity }) => {
  const artist =
    vertical && copy.verticalArtist ? copy.verticalArtist : copy.artistName;
  const title =
    vertical && copy.verticalTitle ? copy.verticalTitle : copy.songTitle;
  const color = video ? copy.videoTextColor : copy.textColor;
  return (
    <div
      style={{
        position: "absolute",
        left: vertical ? 80 : 130,
        top: vertical ? 620 : 170,
        width: vertical ? 820 : 1150,
        opacity,
        color,
      }}
    >
      <Fit
        text={artist}
        bold
        size={vertical ? 104 : 102}
        width={vertical ? 820 : 1150}
        height={vertical ? 220 : 110}
      />
      <Fit
        text={title}
        size={vertical ? 100 : 96}
        width={vertical ? 820 : 1150}
        height={vertical ? 210 : 110}
        style={{ color: video ? color : copy.songTitleColor, marginTop: 5 }}
      />
      <div
        style={{
          display: "inline-block",
          marginTop: 26,
          border: "3px solid currentColor",
          borderRadius: 8,
          padding: "6px 12px",
        }}
      >
        <FittedDoohText
          text={copy.pillCopy}
          prefix="Mega"
          family="MegaRoboto"
          baseSize={26}
          maxWidth={vertical ? 730 : 1000}
          maxHeight={36}
          style={{}}
        />
      </div>
    </div>
  );
};

export const ArtistEMP: React.FC<EmpInput> = (input) => {
  const f = useCurrentFrame(),
    { fps } = useVideoConfig();
  const copy = resolveEmp(input),
    variant = (input.outputVariant ?? "landscape-15") as Variant;
  const spec = outputs[variant];
  if (!spec) throw new Error("Unknown EMP output");
  const banner = spec.format === "png";
  if (banner) {
    const scale = spec.width / 300;
    return (
      <AbsoluteFill style={{ background: copy.bannerColor }}>
        <DoohFonts prefix="Mega" />
        <div
          style={{
            ...pos,
            width: 300,
            height: 60,
            transform: `scale(${scale})`,
            color: copy.bannerTextColor,
          }}
        >
          <Fit
            text={copy.artistName}
            bold
            size={26}
            width={270}
            height={27}
            style={{ position: "absolute", left: 15, top: 5 }}
          />
          <Fit
            text={copy.songTitle}
            size={20}
            width={270}
            height={22}
            style={{ position: "absolute", left: 15, top: 31 }}
          />
        </div>
      </AbsoluteFill>
    );
  }
  const scene = geometry[variant as keyof typeof geometry];
  const vertical = variant.startsWith("social"),
    short = variant.endsWith("-10");
  const time = f / fps,
    photoEntry = short ? 0 : 3.35,
    videoEntry = short ? 3.3 : 6.8;
  const audio = short ? copy.fullAudio10 : copy.fullAudio15;
  const linerStart = short ? 0.55 : 4.04;
  const voiceActive = time >= linerStart - 0.15 && time < linerStart + 3.8;
  return (
    <AbsoluteFill
      style={{ background: copy.backgroundColor, overflow: "hidden" }}
    >
      <DoohFonts prefix="Mega" />
      {/* A supplied duration-specific full mix replaces source-video audio, never doubles it. */}
      <Audio
        src={src(audio || copy.featuredVideo)}
        volume={audio || !copy.artistLiner ? 1 : voiceActive ? 0.25 : 0.8}
      />
      {!audio && copy.artistLiner && (
        <Sequence from={Math.round(linerStart * fps)} layout="none">
          <Audio src={src(copy.artistLiner)} />
        </Sequence>
      )}
      {[...scene.planes].reverse().map((plane, index) => {
        const row = rowAt(plane.rows, f),
          corners = [
            row.slice(0, 2),
            row.slice(2, 4),
            row.slice(4, 6),
            row.slice(6, 8),
          ];
        if (row[8] < 0.001) return null;
        let h = homography(plane.width, plane.height, corners);
        const w = (h[6] * plane.width) / 2 + (h[7] * plane.height) / 2 + h[8];
        if (w < 0) h = h.map((v) => -v);
        const det =
          h[0] * (h[4] * h[8] - h[5] * h[7]) -
          h[1] * (h[3] * h[8] - h[5] * h[6]) +
          h[2] * (h[3] * h[7] - h[4] * h[6]);
        if (!h.every(Number.isFinite) || det <= 0) return null;
        const video = plane.kind === "video",
          bookend = plane.kind === "bookend";
        const fade = interpolate(
          time,
          [photoEntry, photoEntry + 0.35],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <div
            key={index}
            style={{
              ...pos,
              width: plane.width,
              height: plane.height,
              transform: matrix(h),
              opacity: row[8],
              overflow: "hidden",
              background: bookend ? copy.backgroundColor : undefined,
            }}
          >
            {bookend ? (
              <div
                style={{
                  opacity: short
                    ? 1
                    : interpolate(time, [0.2, 0.65], [0, 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      }),
                  transform: `translateY(${short ? 0 : interpolate(time, [0.2, 1.1], [45, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
                }}
              >
                <Logo
                  x={(plane.width - 520) / 2}
                  y={(plane.height - 116) / 2}
                  width={520}
                />
              </div>
            ) : (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: vertical ? 0 : 420,
                  width: plane.width,
                  height: vertical ? 1920 : 1080,
                  overflow: "hidden",
                  borderRadius: 70,
                  background: copy.backgroundColor,
                }}
              >
                {video ? (
                  <Sequence from={Math.floor(videoEntry * fps)} layout="none">
                    <OffthreadVideo
                      src={src(copy.featuredVideo)}
                      trimBefore={Math.floor(videoEntry * fps)}
                      muted
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </Sequence>
                ) : (
                  <Img
                    src={src(copy.featuredArtistImage)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
                <AbsoluteFill
                  style={{
                    background:
                      "linear-gradient(120deg,rgba(0,0,0,.25),transparent 70%)",
                  }}
                />
                <Logo
                  x={vertical ? 80 : 1300}
                  y={vertical ? 440 : 170}
                  width={vertical ? 420 : 420}
                  color={video ? copy.videoTextColor : copy.textColor}
                />
                <CopyBlock
                  copy={copy}
                  vertical={vertical}
                  video={video}
                  opacity={video ? 1 : fade}
                />
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
export const EmpCompositions = () => (
  <Composition
    id="emp-v1"
    component={ArtistEMP}
    defaultProps={empDefaults}
    width={1920}
    height={1080}
    fps={30000 / 1001}
    durationInFrames={450}
    calculateMetadata={({ props }) => {
      resolveEmp(props as EmpInput);
      const spec = outputs[(props.outputVariant ?? "landscape-15") as Variant];
      if (!spec) throw new Error("Unknown EMP output");
      return {
        width: spec.width,
        height: spec.height,
        fps: spec.fps,
        durationInFrames: spec.durationInFrames,
      };
    }}
  />
);
