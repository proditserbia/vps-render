import { FittedDoohSvgText } from "../FittedDoohText";
import { doohStaticAsset, DoohFonts } from "../doohAssets";
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { artistLADefaults, type ArtistLAProps } from "./ArtistSunsetLA";
import { GodzillaSidePanel } from "./ArtistGodzilla";
import { GodzillaGlass } from "./GodzillaGlass";
import geometry from "../data/megazilla-geometry.json";
import streetTrack from "../data/social-tracking.json";
import { homography, matrix, rowAt } from "./megaProjection";
import { resolveDoohProps } from "./UsDoohTesting";

type Element = {
  id: string;
  kind: string;
  rect: number[];
  asset?: string;
  text?: string;
  font?: string;
  fontSize?: number;
  color?: number[];
  rows: number[][];
};
const elements = geometry.items as Element[];
const plane: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  transformOrigin: "0 0",
};
const asset = (uri: string) =>
  /^(https?:|data:|blob:)/.test(uri) ? uri : staticFile(uri);
export const megazillaDefaults: ArtistLAProps = {
  ...artistLADefaults,
  background: doohStaticAsset("assets/godzilla/insitu-background.png"),
};
export const megaPanels = [
  { id: "farleft-panel01", width: 2352, height: 1666, x: 0, y: 0 },
  { id: "centerleft-panel02", width: 4124, height: 1666, x: 2352, y: 0 },
  { id: "centerright-panel03", width: 4124, height: 1666, x: 6476, y: 0 },
  { id: "farright-panel04", width: 1952, height: 1666, x: 10600, y: 0 },
  { id: "bottomcenter-panel05", width: 4840, height: 1198, x: 4056, y: 1666 },
];
const Fonts = () => <DoohFonts prefix="Mega" />;
function pose(e: Element, f: number) {
  const r = rowAt(e.rows, f),
    corners = [r.slice(0, 2), r.slice(2, 4), r.slice(4, 6), r.slice(6, 8)];
  // Essential-property UI offset in the Mega image instance.
  if (e.id === "photoLike" || e.id === "photoSubscribe") {
    const m = rowAt(elements.find((x) => x.id === "photoMask")!.rows, f);
    corners.forEach((p) => {
      p[0] += ((m[2] - m[0]) * 240) / 8779;
      p[1] += ((m[3] - m[1]) * 240) / 8779;
    });
  }
  return {
    corners,
    opacity: r[8],
    h: homography(Math.max(e.rect[2], 1), Math.max(e.rect[3], 1), corners),
  };
}
function maskAt(id: string, f: number) {
  const e = elements.find((x) => x.id === id)!;
  const { corners } = pose(e, f);
  const pts = [corners[0], corners[1], corners[3], corners[2]];
  const near = (a: number[], b: number[]) => {
    const k = Math.min(0.12, 240 / Math.hypot(b[0] - a[0], b[1] - a[1]));
    return a.map((v, i) => v + (b[i] - v) * k);
  };
  let d = "";
  pts.forEach((p, i) => {
    const a = near(p, pts[(i + 3) % 4]),
      b = near(p, pts[(i + 1) % 4]);
    d += `${i ? "L" : "M"}${a.join(" ")} Q${p.join(" ")} ${b.join(" ")} `;
  });
  return `path('${d}Z')`;
}
const Tracked: React.FC<{
  element: Element;
  frame: number;
  props: ArtistLAProps;
}> = ({ element: e, frame, props }) => {
  const { fps } = useVideoConfig();
  const { opacity, h } = pose(e, frame);
  const [, , width, height] = e.rect;
  if (
    opacity < 0.001 ||
    !h.every(Number.isFinite) ||
    width < 0.01 ||
    height < 0.01
  )
    return null;
  const style: React.CSSProperties = {
    ...plane,
    width,
    height,
    opacity,
    transform: matrix(h),
  };
  let child: React.ReactNode;
  if (e.kind === "image")
    child = (
      <Img
        src={asset(props.featuredArtistImage)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  else if (e.kind === "video")
    child = (
      <Sequence from={Math.round((247 / 60) * fps)} layout="none">
        <OffthreadVideo
          src={asset(props.featuredVideo)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </Sequence>
    );
  else if (e.kind === "asset")
    child = (
      <Img
        src={doohStaticAsset(e.asset!)}
        style={{ width: "100%", height: "100%" }}
      />
    );
  else if (e.kind.startsWith("logo-"))
    child = (
      <Img
        src={doohStaticAsset(`assets/la-sunset/${e.kind}.png`)}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    );
  else if (["bar", "circle", "tint"].includes(e.kind))
    child = (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: e.kind === "circle" ? "50%" : 0,
          background: e.kind === "tint" ? "#ffffff40" : "#ff0060",
        }}
      />
    );
  else if (e.kind === "pill")
    child = (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <rect
          x={5}
          y={5}
          width={width - 10}
          height={height - 10}
          rx={height * 0.15}
          fill={e.id.startsWith("closing") ? "none" : "white"}
          stroke={e.id.startsWith("closing") ? "white" : "#202020"}
          strokeWidth={10}
        />
        <FittedDoohSvgText
          text={props.pillCopy}
          prefix="Mega"
          family="MegaRoboto"
          baseSize={height * 0.52}
          maxWidth={width * 0.85}
          maxHeight={height * 0.52}
          x={width / 2}
          y={height * 0.69}
          textAnchor="middle"
          fill={e.id.startsWith("closing") ? "white" : "#202020"}
        />
      </svg>
    );
  else {
    const text = e.kind === "title" ? props.songTitle : props.artistName;
    const fill = e.id.startsWith("closing")
      ? "white"
      : e.kind === "title"
        ? "#142467"
        : "#202020";
    child = (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        overflow="visible"
      >
        <FittedDoohSvgText
          text={text}
          prefix="Mega"
          family={e.kind === "title" ? "MegaBold" : "MegaExtra"}
          baseSize={(e.fontSize ?? height) * 0.8}
          maxWidth={width * 0.98}
          maxHeight={height * 0.8}
          x={0}
          y={height * 0.8}
          fill={fill}
        />
      </svg>
    );
  }
  return <div style={style}>{child}</div>;
};
const Progress: React.FC<{ id: string; frame: number }> = ({ id, frame }) => {
  const e = elements.find((x) => x.id === id)!;
  const { h } = pose(e, frame);
  const w = e.rect[2],
    ht = e.rect[3];
  const photo = id === "photoMask";
  const y = ht * (photo ? 0.952 : 0.752);
  const progress = photo
    ? Math.min(0.95, 0.2 + (frame / 60) * 0.197)
    : Math.min(0.95, 0.46 + ((frame - 247) / (900 - 247)) * 0.5);
  return (
    <div style={{ ...plane, width: w, height: ht, transform: matrix(h) }}>
      <svg width={w} height={ht}>
        <path
          d={`M${w * 0.05} ${y} H${w * 0.95}`}
          stroke="#ffffff40"
          strokeWidth={14}
        />
        <path
          d={`M${w * 0.05} ${y} H${w * progress}`}
          stroke="#ff0060"
          strokeWidth={14}
        />
        <circle cx={w * progress} cy={y} r={20} fill="#ff0060" />
      </svg>
    </div>
  );
};
export const MegazillaCenter: React.FC<
  ArtistLAProps & { masked?: boolean }
> = ({ masked = true, ...props }) => {
  const f = (useCurrentFrame() * 60) / useVideoConfig().fps;
  const draw = (ids: string[]) =>
    elements
      .filter((e) => ids.includes(e.id))
      .map((e) => <Tracked key={e.id} element={e} frame={f} props={props} />);
  return (
    <div
      style={{
        ...plane,
        width: 8248,
        height: 2864,
        overflow: "hidden",
        background: "white",
        clipPath: masked
          ? "polygon(0 0,8248px 0,8248px 1666px,6544px 1666px,6544px 2864px,1704px 2864px,1704px 1666px,0 1666px)"
          : undefined,
      }}
    >
      <Fonts />
      {f >= 247 && (
        <div
          style={{
            ...plane,
            width: 8248,
            height: 2864,
            clipPath: maskAt("videoMask", f),
          }}
        >
          {draw(["video", "videoLike", "videoSubscribe", "videoLogo"])}
          <Progress id="videoMask" frame={f} />
        </div>
      )}
      {f < 310 &&
        draw([
          "openingArtist",
          "openingArtist2",
          "openingTitle",
          "openingPill",
          "openingLogo",
          "logoFrame1",
          "logoFrame2",
        ])}
      {f < 306 && (
        <div
          style={{
            ...plane,
            width: 8248,
            height: 2864,
            clipPath: maskAt("photoMask", f),
          }}
        >
          {draw(["photo", "photoLike", "photoSubscribe"])}
          <Progress id="photoMask" frame={f} />
        </div>
      )}
      {f >= 304 &&
        draw([
          "closingArtist",
          "closingArtist2",
          "closingTitle",
          "closingPill",
        ])}
    </div>
  );
};
export const MegazillaMaster: React.FC<ArtistLAProps> = (props) => (
  <AbsoluteFill style={{ background: "#444", overflow: "hidden" }}>
    <div style={{ ...plane, width: 2352, height: 1666 }}>
      <GodzillaSidePanel {...props} side="left" />
    </div>
    <div style={{ ...plane, left: 2352, width: 8248, height: 2864 }}>
      <MegazillaCenter {...props} />
    </div>
    <div style={{ ...plane, left: 10600, width: 1952, height: 1666 }}>
      <GodzillaSidePanel {...props} side="right" />
    </div>
  </AbsoluteFill>
);
export const MegazillaFlat: React.FC<ArtistLAProps> = (props) => (
  <div style={{ ...plane, width: 12552, height: 2864, transform: "scale(.5)" }}>
    <MegazillaMaster {...props} />
  </div>
);
const Panel: React.FC<ArtistLAProps & { panelIndex: number }> = ({
  panelIndex,
  ...props
}) => {
  const p = megaPanels[panelIndex];
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{ ...plane, left: -p.x, top: -p.y, width: 12552, height: 2864 }}
      >
        <MegazillaMaster {...props} />
      </div>
    </AbsoluteFill>
  );
};
const Surface: React.FC<{
  width: number;
  height: number;
  h: number[];
  children: React.ReactNode;
}> = ({ width, height, h, children }) => (
  <div style={{ ...plane, width, height, transform: matrix(h) }}>
    {children}
  </div>
);
export const MegazillaInSitu: React.FC<ArtistLAProps> = (props) => {
  const h = homography(8248, 1666, [
    [407.02, 423.83],
    [1512.52, 62.37],
    [390.75, 637.77],
    [1546.92, 413.26],
  ]);
  return (
    <AbsoluteFill style={{ background: "black", overflow: "hidden" }}>
      <GodzillaGlass />
      <Img
        src={doohStaticAsset("assets/godzilla/insitu-background.png")}
        style={{ width: 1920, height: 1080 }}
      />
      <Surface width={8248} height={2864} h={h}>
        <MegazillaCenter {...props} />
      </Surface>
      <Surface
        width={1952}
        height={1666}
        h={homography(1952, 1666, [
          [1504.74, 74.01],
          [1708.28, 205.51],
          [1538.62, 413.19],
          [1753.2, 496.71],
        ])}
      >
        <GodzillaSidePanel {...props} side="right" />
      </Surface>
      <svg width={0} height={0}>
        <defs>
          <clipPath id="mega-canopy">
            <path d="M732 319 C748 262 820 232 1009 231 Z" />
          </clipPath>
        </defs>
      </svg>
      <Img
        src={doohStaticAsset("assets/godzilla/insitu-foreground.png")}
        style={{
          ...plane,
          width: 1920,
          height: 1080,
          clipPath: "url(#mega-canopy)",
          filter: "url(#godzilla-glass-transmission-v4)",
        }}
      />
    </AbsoluteFill>
  );
};
export const MegazillaSocial: React.FC<ArtistLAProps> = (props) => {
  const index = Math.min(
    449,
    Math.round((useCurrentFrame() * 30) / useVideoConfig().fps),
  );
  const track = streetTrack[index];
  const [anchor, pos, scale] = track[1] as number[][];
  const corners = track[2] as number[][];
  const side = track[3] as number[][];
  const [sa, sp, ss] = track[4] as number[][];
  const sidePoints = side.map(([x, y]) => [
    sp[0] + ((x - sa[0]) * ss[0]) / 100,
    sp[1] + ((y - sa[1]) * ss[1]) / 100,
  ]);
  return (
    <AbsoluteFill style={{ background: "black", overflow: "hidden" }}>
      <Audio src={doohStaticAsset("assets/audio/ny-street-ambient.m4a")} />
      <div
        style={{
          ...plane,
          width: 4096,
          height: 2304,
          transform: `translate(${pos[0]}px,${pos[1]}px) scale(${scale[0] / 100}) translate(${-anchor[0]}px,${-anchor[1]}px)`,
        }}
      >
        <OffthreadVideo
          muted
          src={doohStaticAsset("assets/social/ny-street.mp4")}
          style={{ width: 4096, height: 2304 }}
        />
        <Surface width={8248} height={2864} h={homography(8248, 2864, corners)}>
          <MegazillaCenter {...props} />
        </Surface>
        <Surface
          width={1952}
          height={1666}
          h={homography(1952, 1666, sidePoints)}
        >
          <GodzillaSidePanel {...props} side="right" />
        </Surface>
      </div>
      {(index <= 45 || index >= 360) && (
        <Img
          src={doohStaticAsset(
            `assets/social/branding/${String(index).padStart(3, "0")}.png`,
          )}
          style={{ ...plane, width: 1080, height: 1920 }}
        />
      )}
    </AbsoluteFill>
  );
};
type Input = Record<string, unknown>;
export const megazillaOutputs: Record<
  string,
  { width: number; height: number; fps: number; durationInFrames: number }
> = {
  flat: { width: 6276, height: 1432, fps: 30, durationInFrames: 450 },
  insitu: { width: 1920, height: 1080, fps: 30, durationInFrames: 450 },
  social: { width: 1080, height: 1920, fps: 30, durationInFrames: 450 },
  ...Object.fromEntries(
    megaPanels.map((p, i) => [
      `panel0${i + 1}`,
      { width: p.width, height: p.height, fps: 60, durationInFrames: 900 },
    ]),
  ),
};
const AppScene: React.FC<Input> = (input) => {
  const props = resolveDoohProps("ny", input),
    variant = String(input.outputVariant);
  if (!Object.hasOwn(megazillaOutputs, variant))
    throw Error(`Unsupported Megazilla output: ${variant}`);
  if (variant === "flat") return <MegazillaFlat {...props} />;
  if (variant === "insitu") return <MegazillaInSitu {...props} />;
  if (variant === "social") return <MegazillaSocial {...props} />;
  return <Panel {...props} panelIndex={Number(variant.slice(-1)) - 1} />;
};
const appDefaults: Input = {
  outputVariant: "flat",
  artistName: { type: "text", value: "Artist Name" },
  songTitle: { type: "text", value: "SONG TITLE" },
  pillCopy: { type: "text", value: "New Single" },
  featuredArtistImage: {
    type: "image",
    uri: megazillaDefaults.featuredArtistImage,
  },
  featuredVideo: { type: "video", uri: megazillaDefaults.featuredVideo },
};
export const MegazillaCompositions = () => (
  <>
    <Composition
      id="us-dooh-mega-test-v1"
      component={AppScene}
      {...megazillaOutputs.flat}
      defaultProps={appDefaults}
      calculateMetadata={({ props }) => {
        resolveDoohProps("ny", props);
        const variant = String(props.outputVariant);
        if (!Object.hasOwn(megazillaOutputs, variant))
          throw Error(`Unsupported Megazilla output: ${variant}`);
        return megazillaOutputs[variant];
      }}
    />
    <Composition
      id="artist-megazilla-master-v1"
      component={MegazillaMaster}
      width={12552}
      height={2864}
      fps={60}
      durationInFrames={900}
      defaultProps={megazillaDefaults}
    />
    <Composition
      id="artist-megazilla-flat-v1"
      component={MegazillaFlat}
      width={6276}
      height={1432}
      fps={30}
      durationInFrames={450}
      defaultProps={megazillaDefaults}
    />
    <Composition
      id="artist-megazilla-insitu-v1"
      component={MegazillaInSitu}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={450}
      defaultProps={megazillaDefaults}
    />
    <Composition
      id="artist-megazilla-social-v1"
      component={MegazillaSocial}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={450}
      defaultProps={megazillaDefaults}
    />
    {megaPanels.map((p, i) => (
      <Composition
        key={p.id}
        id={`artist-megazilla-${p.id}-v1`}
        component={Panel}
        width={p.width}
        height={p.height}
        fps={60}
        durationInFrames={900}
        defaultProps={{ ...megazillaDefaults, panelIndex: i }}
      />
    ))}
  </>
);
