import React from "react";
import {
  AbsoluteFill,
  Composition,
  Img,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { EmpAudio } from "./EmpAudio";
import {empTiming, readEmpStart, validateEmpSource} from './empTiming';
import {empPalette} from './empPalette';
import { EmpBrand, empCopyMotion } from "./EmpMotion";
import outputs from "../empOutputs.json";
import geometry from "../data/emp-geometry.json";
import { matrix } from "./megaProjection";
import { empPlaneAt } from "./empProjection";
import { DoohFonts, doohStaticAsset } from "../doohAssets";
import { FittedDoohText } from "../FittedDoohText";

type Variant = keyof typeof outputs;
type Slot = string | { type?: string; value?: string | number; uri?: string };
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
  const value = typeof v === "string" ? v : (v?.value ?? v?.uri ?? fallback);
  if (typeof value !== 'string') throw new Error(`Invalid ${key}`);
  return value.trim();
};
export function resolveEmp(p: EmpInput): Copy {
  readEmpStart(p.emp10InMs); readEmpStart(p.emp15InMs);
  const result: Record<string, string> = {};
  for (const key of [
    "artistName",
    "songTitle",
    "pillCopy",
    "featuredArtistImage",
  ]) {
    result[key] = read(p, key);
    if (!result[key]) throw new Error(`EMP requires ${key}`);
  }
  for (const key of ["artistName", "songTitle", "pillCopy"])
    if (result[key].length > 160) throw new Error(`${key} is too long`);
  // Ignore legacy role overrides on retries; current renders follow the fixed design.
  Object.assign(result,empPalette(read(p,'songTitleColor','#ff8732')));
  for (const key of [
    "featuredVideo",
    "verticalArtist",
    "verticalTitle",
    "fullAudio10",
    "fullAudio15",
    "artistLiner",
  ])
    result[key] = read(p, key);
  for (const key of ["verticalArtist", "verticalTitle"])
    if (result[key].length > 160) throw new Error(`${key} is too long`);
  if (!result.featuredVideo && (readEmpStart(p.emp10InMs)!==0 || readEmpStart(p.emp15InMs)!==0))
    throw new Error('EMP source start requires a featured video');
  return result as Copy;
}
export const empDefaults: EmpInput = {
  artistName: "Gracie Abrams",
  songTitle: "Look at My Life",
  pillCopy: "New Song",
  featuredArtistImage: "assets/emp/artist.jpg",
  // Missing PMV must never silently pick up the local demo video.
  featuredVideo: "",
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
  profile: "landscape-10" | "landscape-15" | "social-10" | "social-15";
  motionTime: number;
}> = ({ copy, vertical, video, profile, motionTime }) => {
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
        top: vertical ? 620 : 180,
        width: vertical ? 820 : 1150,
        color,
      }}
    >
      <div
        style={video ? undefined : empCopyMotion(profile, "artist", motionTime)}
      >
        <Fit
          text={artist}
          bold
          size={vertical ? 104 : 114}
          width={vertical ? 820 : 1150}
          height={vertical ? 220 : 120}
          style={{ marginBottom: vertical ? "-.08em" : "-.1em" }}
        />
      </div>
      <div
        style={video ? undefined : empCopyMotion(profile, "title", motionTime)}
      >
        <Fit
          text={title}
          size={vertical ? 100 : 108}
          width={vertical ? 820 : 1150}
          height={vertical ? 210 : 110}
          style={{
            color: video ? color : copy.songTitleColor,
            marginTop: 0,
          }}
        />
      </div>
      <div
        style={{
          ...(video ? {} : empCopyMotion(profile, "pill", motionTime)),
          display: "inline-block",
          marginTop: vertical ? 56 : 38,
          border: "3px solid currentColor",
          borderRadius: 8,
          padding: vertical ? "6px 12px" : "7px 12px",
        }}
      >
        <FittedDoohText
          text={copy.pillCopy}
          prefix="Mega"
          family="MegaRoboto"
          baseSize={vertical ? 26 : 28}
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
  const time = f / fps;
  const timing = empTiming(readEmpStart(input[short ? 'emp10InMs' : 'emp15InMs']), short);
  const audio = short ? copy.fullAudio10 : copy.fullAudio15;
  return (
    <AbsoluteFill
      style={{ background: copy.backgroundColor, overflow: "hidden" }}
    >
      <DoohFonts prefix="Mega" />
      <EmpAudio
        music={copy.featuredVideo ? src(copy.featuredVideo) : ''}
        fullMix={audio ? src(audio) : ""}
        liner={copy.artistLiner ? src(copy.artistLiner) : ""}
        short={short}
        musicStartFrame={timing.startFrame}
      />
      {[...scene.planes].reverse().map((plane, index) => {
        const { h, opacity } = empPlaneAt(plane, f, scene);
        if (opacity < 0.001) return null;
        const det =
          h[0] * (h[4] * h[8] - h[5] * h[7]) -
          h[1] * (h[3] * h[8] - h[5] * h[6]) +
          h[2] * (h[3] * h[7] - h[4] * h[6]);
        if (!h.every(Number.isFinite) || det <= 0) return null;
        const video = plane.kind === "video",
          bookend = plane.kind === "bookend";
        return (
          <div
            key={index}
            style={{
              ...pos,
              width: plane.width,
              height: plane.height,
              transform: matrix(h),
              opacity,
              overflow: "hidden",
              background: bookend ? copy.backgroundColor : undefined,
            }}
          >
            {bookend ? (
              <EmpBrand time={short ? 2 : Math.min(time, 2)} />
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
                {video && copy.featuredVideo ? (
                  <Sequence from={timing.revealFrame} layout="none">
                    <OffthreadVideo
                      src={src(copy.featuredVideo)}
                      trimBefore={timing.videoTrimBefore}
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
                    // Localized scrim travels with the media plane and remains beneath copy.
                    background: vertical
                      ? 'linear-gradient(180deg,transparent 15%,rgba(0,0,0,.42) 30%,rgba(0,0,0,.42) 60%,transparent 80%)'
                      : 'linear-gradient(90deg,rgba(0,0,0,.42),rgba(0,0,0,.28) 48%,transparent 82%)',
                    pointerEvents:'none',
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
                  profile={
                    variant as
                      | "landscape-10"
                      | "landscape-15"
                      | "social-10"
                      | "social-15"
                  }
                  motionTime={
                    time -
                    scene.planes.find((p) => p.kind === "photo")!.start -
                    10 / 3
                  }
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
    calculateMetadata={async ({ props }) => {
      const copy = resolveEmp(props as EmpInput);
      const spec = outputs[(props.outputVariant ?? "landscape-15") as Variant];
      if (!spec) throw new Error("Unknown EMP output");
      if (spec.format !== 'png' && copy.featuredVideo) {
        const short = String(props.outputVariant).endsWith('-10');
        const timing = empTiming(readEmpStart(props[short ? 'emp10InMs' : 'emp15InMs']), short);
        await validateEmpSource(src(copy.featuredVideo), timing.requiredSeconds);
      }
      return {
        width: spec.width,
        height: spec.height,
        fps: spec.fps,
        durationInFrames: spec.durationInFrames,
      };
    }}
  />
);
