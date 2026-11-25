import {DoohVideo} from "../DoohVideo";
import { doohStaticAsset, DoohFonts, loadDoohFonts } from "../doohAssets";
import React from "react";
import {
  AbsoluteFill,
  Composition,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  delayRender,
  continueRender,
  cancelRender,
} from "remotion";
import { GodzillaSideWarp } from "./GodzillaSideWarp";
import measured from "./godzilla-measured.json";
import logoEntry from "./godzilla-logo-entry.json";
import copyCalibration from "./godzilla-copy-calibration.json";
import sideGraphics from "./godzilla-side-graphics.json";
import { GodzillaGlass } from "./GodzillaGlass";
import { artistLADefaults, type ArtistLAProps } from "./ArtistSunsetLA";

export type ArtistGodzillaProps = ArtistLAProps;

// Measure the actual loaded font, not character count: wide letters and narrow
// panel layouts otherwise cause implicit wrapping into the next text layer.
const FittedCopy: React.FC<{
  text: string;
  maxWidth: number;
  style: React.CSSProperties;
}> = ({ text, maxWidth, style }) => {
  const baseSize = Number(style.fontSize);
  const family = String(style.fontFamily);
  const [size, setSize] = React.useState(baseSize);
  const [handle] = React.useState(() => delayRender("Fitting Godzilla copy"));
  React.useEffect(() => {
    let active = true;
    const pending = delayRender("Measuring Godzilla copy");
    loadDoohFonts("Godz")
      .then(() => {
        if (!active) return;
        const context = document.createElement("canvas").getContext("2d");
        if (!context) throw new Error("Text measurement unavailable");
        context.font = `${baseSize}px ${family}`;
        const width = Math.max(
          1,
          ...text.split("\n").map((line) => context.measureText(line).width),
        );
        setSize(baseSize * Math.min(1, maxWidth / width));
        continueRender(pending);
        continueRender(handle);
      })
      .catch((error) => {
        if (active) cancelRender(error);
      });
    return () => {
      active = false;
      continueRender(pending);
      continueRender(handle);
    };
  }, [text, maxWidth, baseSize, family, handle]);
  return (
    <div style={{ ...style, whiteSpace: "pre", fontSize: size }}>{text}</div>
  );
};
export const godzillaDefaults: ArtistGodzillaProps = {
  ...artistLADefaults,
  background: doohStaticAsset("assets/godzilla/insitu-background.png"),
};
type Track = number[][];
type SceneData = {
  width: number;
  photoSource: number[];
  photoMask: number[][];
  photoMasks?: Record<string, number[][]>;
  photo: Track;
  artist: Track;
  title: Track;
  pill: Track;
  videoArtist?: Track;
  videoTitle?: Track;
  videoPill?: Track;
  video?: Track;
  videoMasks?: Record<string, number[][]>;
  logo?: Track;
  buttons?: Track;
  bar?: Track;
};
const scenes = measured as unknown as Record<
  "left" | "center" | "right",
  SceneData
>;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const sample = (track: Track, frame: number) =>
  track.length < 2
    ? (track[0]?.slice(1) ?? identity)
    : track[0].slice(1).map((_, i) =>
        interpolate(
          frame,
          track.map((r) => r[0]),
          track.map((r) => r[i + 1]),
          clamp,
        ),
      );
const matrix = (h: number[]) =>
  `matrix3d(${[h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]].join(",")})`;
const asset = (p: string) =>
  /^(https?:|data:|blob:)/.test(p) ? p : staticFile(p);
const polygon = (points: number[][]) =>
  `polygon(${points.map((p) => `${p[0]}px ${p[1]}px`).join(",")})`;
const plane: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  transformOrigin: "0 0",
};
const FontStyles = () => <DoohFonts prefix="Godz" />;

const Logo: React.FC<{
  x: number;
  y: number;
  width: number;
  white?: boolean;
  icon?: boolean;
}> = ({ x, y, width, white, icon }) =>
  icon ? (
    <svg
      style={{ ...plane, left: x, top: y }}
      width={width}
      height={width * 0.7}
      viewBox="0 0 100 70"
    >
      <path
        fill="#ff0033"
        d="M98 11C97 5 93 2 87 1 64-1 36-1 13 1 7 2 3 5 2 11-1 27-1 43 2 59 3 65 7 68 13 69 36 71 64 71 87 69 93 68 97 65 98 59 101 43 101 27 98 11Z"
      />
      <path fill="white" d="M40 20 66 35 40 50Z" />
    </svg>
  ) : (
    <Img
      src={doohStaticAsset(
        `assets/la-sunset/logo-${white ? "white" : "black"}.png`,
      )}
      style={{
        ...plane,
        left: x - (width * 195) / 1243,
        top: y - (width * 136) / 1243,
        width: (width * 1636) / 1243,
      }}
    />
  );

const Buttons: React.FC<{
  x: number;
  y: number;
  height: number;
  white?: boolean;
}> = ({ x, y, height, white }) => (
  <div
    style={{
      ...plane,
      left: x,
      top: y,
      display: "flex",
      alignItems: "center",
      gap: height * 0.24,
    }}
  >
    <Img
      src={doohStaticAsset("assets/la-sunset/like.png")}
      style={{ width: height * 2.5, height, objectFit: "fill" }}
    />
    {white ? (
      <div
        style={{
          height,
          width: height * 2.7,
          borderRadius: height,
          background: "white",
          boxShadow: "0 0 12px #0003",
          fontFamily: "GodzRoboto",
          fontSize: height * 0.43,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Subscribe
      </div>
    ) : (
      <Img
        src={doohStaticAsset("assets/la-sunset/subscribe.png")}
        style={{ height, width: height * 2.7 }}
      />
    )}
  </div>
);
const Bar: React.FC<{
  width: number;
  y: number;
  dot: number;
  height?: number;
  radius?: number;
}> = ({ width, y, dot, height = 13, radius = height * 1.45 }) => {
 const gradientId = React.useId().replace(/:/g, "");
 return (
  <svg
    width={width}
    height={50}
    style={{ ...plane, top: y - 25, overflow: "visible" }}
  >
    <defs><linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={0} y1={25} x2={Math.max(1, dot)} y2={25}><stop offset="0%" stopColor="#ff0033"/><stop offset="100%" stopColor="#ff2a9b"/></linearGradient></defs>
    <line
      x1={0}
      y1={25}
      x2={width}
      y2={25}
      stroke="#ffffff40"
      strokeWidth={height}
    />
    <line
      x1={0}
      y1={25}
      x2={dot}
      y2={25}
      stroke={`url(#${gradientId})`}
      strokeWidth={height}
    />
    <circle cx={dot} cy={25} r={radius} fill="#ff2a9b" />
  </svg>
);
};

const MovingCopy: React.FC<{
  data: SceneData;
  frame: number;
  props: ArtistGodzillaProps;
  kind: "opening" | "side" | "video";
}> = ({ data, frame, props, kind }) => {
  const opening = kind === "opening",
    video = kind === "video";
  const x = opening ? 2964 : video ? 94 : 47;
  const factor = opening ? 1.25 : video ? 0.975 : data.width < 1100 ? 1.03 : 1;
  const artistSize = 194 * factor,
    titleSize = 182 * factor;
  const tracks = [
    video ? data.videoArtist : data.artist,
    video ? data.videoTitle : data.title,
    video ? data.videoPill : data.pill,
  ];
  const starts = opening
    ? [13, 24, 36]
    : video
      ? [307, 327, 334]
      : [305, data.width > 1100 ? 344 : 342, 350];
  const values = [props.artistName, props.songTitle, props.pillCopy];
  return (
    <>
      {tracks.map((track, i) => {
        if (frame < starts[i] || (opening && frame >= 256)) return null;
        // Early side-title/pill feature matches were degenerate and projected
        // glyphs across the horizon. AE fades these layers in after this point.
        const sideFade = kind === "side" && i > 0;
        const reliableFrom = i === 2 ? 352 : data.width > 1100 ? 346 : 344;
        const t = sideFade
          ? (track ?? []).filter((r) => r[0] >= reliableFrom)
          : (track ?? []);
        if (!opening && !sideFade && t.length && frame < t[0][0]) return null;
        // The earlier pill fade happens at its settled position, so its old
        // entrance path cannot cross the title while both are visible.
        let h = sample(t, opening && i === 2 && frame < 60 ? 60 : frame);
        if (video) {
          // Align browser glyph bounds with the settled AE plane before applying
          // perspective; a few baseline pixels amplify strongly during entry.
          const bounds = [
            [635 / 631, 135 / 134, 91, 81, 94, 77],
            [508 / 502, 129 / 128, 94, 238, 95, 234],
            [336 / 333, 104 / 101, 94, 440, 94, 440],
          ][i];
          const [sx, sy, ax, ay, bx, by] = bounds;
          const c = [sx, 0, ax - sx * bx, 0, sy, ay - sy * by, 0, 0, 1];
          h = Array.from({ length: 9 }, (_, n) =>
            [0, 1, 2].reduce(
              (sum, k) =>
                sum + h[Math.floor(n / 3) * 3 + k] * c[k * 3 + (n % 3)],
              0,
            ),
          );
        } else {
          const [sx, sy, tx, ty] =
            copyCalibration[
              opening ? "opening" : data.width > 1100 ? "left" : "right"
            ][i];
          const c = [sx, 0, tx, 0, sy, ty, 0, 0, 1];
          h = Array.from({ length: 9 }, (_, n) =>
            [0, 1, 2].reduce(
              (sum, k) =>
                sum + h[Math.floor(n / 3) * 3 + k] * c[k * 3 + (n % 3)],
              0,
            ),
          );
        }
        if (opening && t.length && frame > t[t.length - 1][0]) {
          const u = interpolate(
            frame,
            [t[t.length - 1][0], 265],
            [0, 1],
            clamp,
          );
          h = [...h];
          h[2] += u * 2500;
        }
        if (!sideFade && !(opening && i === 2) && t.length && frame < t[0][0]) {
          const progress = interpolate(
            frame,
            [starts[i], t[0][0]],
            [0, 1],
            clamp,
          );
          h = [...h];
          h[2] += (1 - progress) * (opening ? 600 : -850);
        }
        const top = opening
          ? [34, 223, 503][i]
          : [48, 209, video ? 440 : 436][i];
        // Homographies are equivalent up to sign, but CSS clips negative w.
        // Normalize around the actual text, not the entire composition origin.
        if (h[6] * (x + 350) + h[7] * (top + 70) + h[8] < 0) {
          h = h.map((v) => -v);
        }
        // Mirror only the entry displacement, not the glyphs: the opening copy
        // must approach its settled anchor from the right.
        if (opening && i < 2 && frame < 60) {
          const settled = sample(t, 60);
          const [sx, sy, tx, ty] = copyCalibration.opening[i];
          const projectX = (m: number[], px: number, py: number) => (m[0] * px + m[1] * py + m[2]) / (m[6] * px + m[7] * py + m[8]);
          const delta = Math.max(0, projectX(settled, sx*x+tx, sy*top+ty) - projectX(h,x,top)) * 2;
          h = [...h]; h[0] += delta * h[6]; h[1] += delta * h[7]; h[2] += delta * h[8];
        }
        const lines = values[i].split("\n");
        const longest = Math.max(1, ...lines.map((l) => l.length));
        const fit =
          i === 2
            ? Math.min(1, 24 / longest)
            : Math.min(1, (opening ? 17 : 18) / longest, 1 / lines.length);
        return (
          <div
            key={i}
            style={{
              ...plane,
              width: data.width,
              height: 834,
              transform: matrix(h),
              opacity: video
                ? 1
                : sideFade
                  ? Math.pow(
                      interpolate(
                        frame,
                        [starts[i], starts[i] + (i === 2 ? 2 : 4)],
                        [0, 1],
                        clamp,
                      ),
                      i === 1 ? 2 : 1,
                    )
                  : interpolate(
                      frame,
                      [starts[i], starts[i] + 4],
                      [0, 1],
                      clamp,
                    ),
            }}
          >
            <FittedCopy
              text={values[i]}
              maxWidth={Math.max(
                1,
                data.width - x - 47 - (i === 2 ? 68 * factor : 0),
              )}
              style={{
                ...plane,
                left: x,
                top,
                color: video ? "white" : i === 1 ? (props.songTitleColor ?? "#142467") : "#202020",
                whiteSpace: "pre-line",
                lineHeight: 1,
                fontFamily:
                  i === 0 ? "GodzExtra" : i === 1 ? "GodzBold" : "GodzRoboto",
                fontSize:
                  (i === 0 ? artistSize : i === 1 ? titleSize : 55 * factor) *
                  fit,
                ...(i === 2
                  ? {
                      border: `${6 * factor}px solid currentColor`,
                      borderRadius: 19 * factor,
                      padding: `${19 * factor}px ${28 * factor}px`,
                      display: "inline-block",
                    }
                  : {}),
              }}
            />
          </div>
        );
      })}
    </>
  );
};

const Scene: React.FC<{
  name: "left" | "center" | "right";
  props: ArtistGodzillaProps;
  socialCenter?: boolean;
}> = ({ name, props, socialCenter = false }) => {
  const progressGradientId = React.useId().replace(/:/g, "");
  const { fps } = useVideoConfig();
  const frame = (useCurrentFrame() * 60) / fps;
  const data = scenes[name],
    center = name === "center";
  const side = name === "center" ? null : sideGraphics[name];
  const iconPose = side ? sample(side.icon, frame) : [];
  const exitLogoH = side ? sample(side.exitLogoTrack, frame) : identity;
  let photoH = sample(data.photo, frame);
  const lastPhoto = data.photo[data.photo.length - 1][0];
  if (!center && frame > lastPhoto) {
    const u = interpolate(frame, [lastPhoto, 306], [0, 1], clamp);
    photoH = [...photoH];
    for (let i = 0; i < 3; i++)
      photoH[i] = (1 - u) * photoH[i] + u * data.width * photoH[i + 6];
  }
  let videoH = sample(data.video ?? [], frame);
  if (videoH[6] * 640 + videoH[7] * 360 + videoH[8] < 0)
    videoH = videoH.map((v) => -v);
  const videoMasks = data.videoMasks ?? {};
  const maskFrame = Math.min(362, Math.max(262, Math.round(frame)));
  const mask = videoMasks[String(maskFrame)];
  const videoFinal = sample(data.video ?? [], 362);
  // The player settles into a single rectangular plane; keep its graphics
  // attached to the same tracked footage coordinate system during the turn.
  const inverse = (h: number[]) => {
    const [a, b, c, d, e, f, g, k, j] = h;
    const det = a * (e * j - f * k) - b * (d * j - f * g) + c * (d * k - e * g);
    return [
      (e * j - f * k) / det,
      (c * k - b * j) / det,
      (b * f - c * e) / det,
      (f * g - d * j) / det,
      (a * j - c * g) / det,
      (c * d - a * f) / det,
      (d * k - e * g) / det,
      (b * g - a * k) / det,
      (a * e - b * d) / det,
    ];
  };
  const multiply = (a: number[], b: number[]) =>
    Array.from({ length: 9 }, (_, i) =>
      [0, 1, 2].reduce(
        (s, k) => s + a[Math.floor(i / 3) * 3 + k] * b[k * 3 + (i % 3)],
        0,
      ),
    );
  if (center && frame >= 254 && frame <= 270) {
    const invPhoto = inverse(photoH);
    // Choose the visible side of the near-edge-on plane using a screen point
    // inside the outgoing photograph, rather than an off-screen source origin.
    if (invPhoto[6] * 3500 + invPhoto[7] * 417 + invPhoto[8] < 0)
      photoH = photoH.map((v) => -v);
  }
  const uiH = center ? multiply(videoH, inverse(videoFinal)) : identity;
  // The strongest AE lens warp is not planar. Retain the prior UI there,
  // blending smoothly to the measured correction on either side of the turn.
  const sideUiBlend =
    name === "left"
      ? interpolate(frame, [0, 264, 267, 269, 272], [1, 1, 0, 0, 1], clamp)
      : interpolate(frame, [0, 260, 263, 266, 270], [1, 1, 0, 0, 1], clamp);
  const buttonOffset = side
    ? sample(side.photoButtonOffset, frame).map((v) => v * sideUiBlend)
    : [0, 0];
  const buttonCorrection =
    side && frame < 306
      ? multiply(
          [1, 0, buttonOffset[0], 0, 1, buttonOffset[1], 0, 0, 1],
          photoH,
        )
      : identity;
  const likeOffset = side
    ? sample(side.photoLikeOffset, frame).map((v) => v * sideUiBlend)
    : [0, 0];
  const likeCorrection =
    side && frame < 306
      ? multiply([1, 0, likeOffset[0], 0, 1, likeOffset[1], 0, 0, 1], photoH)
      : identity;
  const sideButtonHeight = name === "left" ? 52 : 50;
  const sideButtonX = name === "left" ? 49 : 47;
  const sideButtonY = name === "left" ? 482 : 485;
  // The incoming logo has its own AE motion, independent of the video plane.
  const logoH = center ? sample([...logoEntry, ...(data.logo ?? [])], frame) : identity;
  const buttonsH =
    data.buttons?.length && frame >= data.buttons[0][0]
      ? sample(data.buttons, frame)
      : uiH;
  const bar = data.bar?.length ? sample(data.bar, frame) : [0, 684, 1700, 684];
  const lastBarFrame = data.bar?.[data.bar.length - 1]?.[0] ?? 362;
  if (frame > lastBarFrame) bar[2] += (frame - lastBarFrame) * 1.45;
  const endW = uiH[6] * 3960 + uiH[7] * 684 + uiH[8];
  const end = [
    (uiH[0] * 3960 + uiH[1] * 684 + uiH[2]) / endW,
    (uiH[3] * 3960 + uiH[4] * 684 + uiH[5]) / endW,
  ];
  // Cover the taller social photo area without inheriting the narrow LED crop.
  // Compensate for the social surface's vertical scale so the photograph keeps its aspect ratio.
  const socialPhotoScaleY = 2.25 / (2864 / 1668);
  const photoSource = socialCenter
    ? [
        2.25,
        0,
        0,
        0,
        socialPhotoScaleY,
        (804 - 720 * socialPhotoScaleY) / 2,
        0,
        0,
        1,
      ]
    : data.photoSource;
  let photoImageH = multiply(photoH, photoSource);
  if (center && frame >= 254 && frame <= 270) {
    const invImage = inverse(photoImageH);
    if (invImage[6] * 3500 + invImage[7] * 417 + invImage[8] < 0)
      photoImageH = photoImageH.map((v) => -v);
  }
  const photoBottom = center ? 804 : 646;
  const warpPhoto =
    !center && frame > 246 && frame < (name === "left" ? 280 : 284);
  const directPhoto = center && frame >= 254 && frame <= 270;
  const photoOutline = data.photoMasks?.[String(Math.round(frame))];
  // The outgoing photo remains in front of the incoming player until it exits.
  // AE silhouettes overlap here; the video matte alone includes both planes.
  const outsidePhoto =
    center && frame < 306 && photoOutline?.length
      ? `polygon(evenodd, 0px 0px, 4124px 0px, 4124px 834px, 0px 834px, 0px 0px, ${[...photoOutline, photoOutline[0]].map(([x, y]) => `${x}px ${y}px`).join(",")})`
      : undefined;
  return (
    <div
      style={{
        ...plane,
        width: data.width,
        height: 834,
        overflow: "hidden",
        background: socialCenter && frame >= 306 ? "#111" : "white",
      }}
    >
      {center && (
        <div
          style={{
            ...plane,
            transform: socialCenter ? "scaleY(0.5824)" : undefined,
          }}
        >
          <MovingCopy data={data} frame={frame} props={props} kind="opening" />
        </div>
      )}
      {frame < 306 && (
        <>
          <div
            style={{
              ...plane,
              width: data.width,
              height: 834,
              clipPath: data.photoMasks?.[String(Math.round(frame))]
                ? polygon(data.photoMasks[String(Math.round(frame))])
                : undefined,
            }}
          >
            {warpPhoto && (
              <GodzillaSideWarp
                side={name as "left" | "right"}
                frame={frame}
                width={data.width}
              >
                <Img
                  src={asset(props.featuredArtistImage)}
                  style={{
                    ...plane,
                    width: 1280,
                    height: 720,
                    objectFit: "cover",
                    transform: matrix(photoImageH),
                  }}
                />
              </GodzillaSideWarp>
            )}
            {directPhoto && (
              <Img
                src={asset(props.featuredArtistImage)}
                style={{
                  ...plane,
                  width: 1280,
                  height: 720,
                  objectFit: "cover",
                  // Compose both transforms before CSS clips the camera plane.
                  transform: matrix(photoImageH),
                }}
              />
            )}
            <div
              style={{
                ...plane,
                width: data.width,
                height: 834,
                transform: matrix(photoH),
              }}
            >
              <div
                style={{
                  ...plane,
                  width: data.width,
                  height: 834,
                  clipPath: data.photoMasks?.[String(Math.round(frame))]
                    ? undefined
                    : polygon(data.photoMask),
                }}
              >
                <Img
                  src={asset(props.featuredArtistImage)}
                  style={{
                    ...plane,
                    width: 1280,
                    height: 720,
                    objectFit: "cover",
                    transform: matrix(photoSource),
                    visibility: directPhoto || warpPhoto ? "hidden" : "visible",
                  }}
                />
                <div
                  style={{
                    ...plane,
                    width: center ? 2880 : data.width - 40,
                    height: photoBottom,
                    background: "linear-gradient(transparent 65%,#0002)",
                  }}
                />
                {center && <Buttons x={98} y={581} height={75} />}
                <Bar
                  width={center ? 2730 : data.width - 108}
                  y={center ? 721 : name === "left" ? 565 : 566}
                  dot={
                    center
                      ? 1080 + frame * 0.9
                      : name === "left"
                        ? 341.7 + frame * 0.4056
                        : 344 + frame * 0.2972
                  }
                  height={
                    center
                      ? 20
                      : 13 + sideUiBlend * ((name === "left" ? 11.5 : 9) - 13)
                  }
                  radius={
                    center
                      ? undefined
                      : 13 * 1.45 +
                        sideUiBlend *
                          ((name === "left" ? 16.5 : 13) - 13 * 1.45)
                  }
                />
              </div>
            </div>
            {!center && (
              <>
                <div style={{ ...plane, transform: matrix(likeCorrection) }}>
                  <Img
                    src={doohStaticAsset("assets/la-sunset/like.png")}
                    style={{
                      ...plane,
                      left: sideButtonX,
                      top: sideButtonY,
                      width: sideButtonHeight * 2.5,
                      height: sideButtonHeight,
                      objectFit: "fill",
                    }}
                  />
                </div>
                <div style={{ ...plane, transform: matrix(buttonCorrection) }}>
                  <Img
                    src={doohStaticAsset("assets/la-sunset/subscribe.png")}
                    style={{
                      ...plane,
                      left: sideButtonX + sideButtonHeight * 2.74,
                      top: sideButtonY,
                      width: sideButtonHeight * 2.7,
                      height: sideButtonHeight,
                      objectFit: "fill",
                    }}
                  />
                </div>
              </>
            )}
          </div>
          {side &&
            frame < (name === "left" ? 288 : 278) &&
            !(frame >= side.exitLogoGap[0] && frame < side.exitLogoGap[1]) && (
              <div
                style={{
                  ...plane,
                  transform: matrix(exitLogoH),
                }}
              >
                <Logo x={47} y={726} width={370} />
              </div>
            )}
          {center && (
            <div
              style={{
                ...plane,
                transform: `translateY(${interpolate(frame, [207, 267], [0, 220], clamp)}px)`,
              }}
            >
              <div
                style={{
                  ...plane,
                  transform: socialCenter
                    ? "translateY(725px) scaleY(0.5824) translateY(-725px)"
                    : undefined,
                }}
              >
                <Logo x={socialCenter ? 2900 : 3700} y={725} width={375} />
              </div>
            </div>
          )}
        </>
      )}
      {center && (
        <Sequence
          from={Math.round((262 / 60) * fps)}
          style={{ clipPath: outsidePhoto }}
        >
          {mask && (
            <div
              style={{
                ...plane,
                width: 4124,
                height: 834,
                clipPath: polygon(mask),
                background: "#111",
              }}
            >
              <div
                style={{
                  ...plane,
                  width: 4124,
                  height: 834,
                  overflow: "hidden",
                  // Flatten the projective video before compositing the player UI above it.
                  isolation: "isolate",
                  opacity: 0.999,
                  transform: "translateZ(0)",
                  contain: "paint",
                  zIndex: 0,
                }}
              >
                <DoohVideo
                  videoStartMs={props.videoStartMs}
                  src={asset(props.featuredVideo)}
                  muted
                  style={{
                    ...plane,
                    width: 1280,
                    height: 720,
                    objectFit: "cover",
                    transform: matrix(videoH),
                    filter: "brightness(.84)",
                  }}
                />
              </div>
              <div
                style={{
                  ...plane,
                  width: 4124,
                  height: 834,
                  zIndex: 1,
                  background:
                    "linear-gradient(90deg,#0004,transparent 30%,transparent 75%,#0003)",
                }}
              />
              <div
                style={{
                  ...plane,
                  width: 4124,
                  height: 834,
                  zIndex: 2,
                  transform: matrix(buttonsH),
                }}
              >
                <div
                  style={{
                    ...plane,
                    transform: socialCenter
                      ? "translateY(515px) scaleY(0.5824) translateY(-515px)"
                      : undefined,
                  }}
                >
                  <Buttons
                    x={socialCenter ? 2600 : 3400}
                    y={515}
                    height={105}
                  />
                </div>
              </div>
            </div>
          )}
        </Sequence>
      )}
      {center && frame >= logoEntry[0][0] && (
        <div style={{ ...plane, width: 4124, height: 834, clipPath: outsidePhoto }}>
              <div
                style={{
                  ...plane,
                  width: 4124,
                  height: 834,
                  zIndex: 2,
                  transform: matrix(logoH),
                }}
              >
                <div
                  style={{
                    ...plane,
                    transform: socialCenter
                      ? "translateY(72px) scaleY(0.5824) translateY(-72px)"
                      : undefined,
                  }}
                >
                  <Logo x={3400} y={72} width={550} white />
                </div>
              </div>
        </div>
      )}
      {center && mask && frame >= 266 && (
        <div
          style={{
            ...plane,
            width: 4124,
            height: 834,
            zIndex: 10,
            clipPath: polygon(mask),
          }}
        >
          <svg
            width={4124}
            height={834}
            style={{ ...plane, clipPath: outsidePhoto }}
          >
            <defs><linearGradient id={progressGradientId} gradientUnits="userSpaceOnUse" x1={bar[0]} y1={bar[1]} x2={bar[2]} y2={bar[3]}><stop offset="0%" stopColor="#ff0033"/><stop offset="100%" stopColor="#ff2a9b"/></linearGradient></defs>
            <line
              x1={bar[0]}
              y1={bar[1]}
              x2={end[0]}
              y2={end[1]}
              stroke="#ffffff40"
              strokeWidth={26}
            />
            <line
              x1={bar[0]}
              y1={bar[1]}
              x2={bar[2]}
              y2={bar[3]}
              stroke={`url(#${progressGradientId})`}
              strokeWidth={26}
            />
            <circle cx={bar[2]} cy={bar[3]} r={38} fill="#ff2a9b" />
          </svg>
        </div>
      )}
      <div
        style={{
          ...plane,
          transform: socialCenter ? "scaleY(0.5824)" : undefined,
        }}
      >
        <MovingCopy
          data={data}
          frame={frame}
          props={props}
          kind={center ? "video" : "side"}
        />
      </div>
      {!center && frame >= 303 && (
        <div
          style={{
            ...plane,
          }}
        >
          {side && frame >= side.icon[0][0] && (
            <Logo x={iconPose[0]} y={iconPose[1]} width={iconPose[2]} icon />
          )}
          <div
            style={{
              ...plane,
              visibility:
                side && frame >= side.buttonMotion[0][0] ? "visible" : "hidden",
              transform: side
                ? matrix(sample(side.buttonMotion, frame))
                : undefined,
            }}
          >
            {side &&
              Object.entries(side.buttons).map(
                ([key, [x, y, width, height]]) => (
                  <Img
                    key={key}
                    src={doohStaticAsset(`assets/godzilla/${key}-white.png`)}
                    style={{
                      ...plane,
                      left: x,
                      top:
                        y +
                        (key === "like"
                          ? interpolate(
                              frame,
                              [333, 341, 345, 353],
                              [25, 18, 10, 0],
                              clamp,
                            )
                          : 0),
                      width,
                      height,
                      filter: "drop-shadow(0 0 2.5px #0003)",
                    }}
                  />
                ),
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export const GodzillaFlat: React.FC<ArtistGodzillaProps> = (props) => (
  <AbsoluteFill style={{ background: "white" }}>
    <FontStyles />
    <Scene name="left" props={props} />
    <div style={{ ...plane, left: 1176 }}>
      <Scene name="center" props={props} />
    </div>
    <div style={{ ...plane, left: 5300 }}>
      <Scene name="right" props={props} />
    </div>
  </AbsoluteFill>
);
export const GodzillaMaster: React.FC<ArtistGodzillaProps> = (props) => (
  <div style={{ ...plane, width: 6276, height: 834, transform: "scale(2)" }}>
    <GodzillaFlat {...props} />
  </div>
);
/** The supplied NY social reference uses the taller, notched center surface. */
export const GodzillaSocialCenter: React.FC<ArtistGodzillaProps> = (props) => (
  <div
    style={{
      ...plane,
      width: 8248,
      height: 2864,
      clipPath:
        "polygon(0 0,100% 0,100% 58.17%,79.44% 58.17%,79.44% 100%,0 100%)",
    }}
  >
    <FontStyles />
    <div
      style={{
        ...plane,
        width: 4124,
        height: 834,
        transform: `scale(2,${2864 / 834})`,
      }}
    >
      <Scene name="center" props={props} socialCenter />
    </div>
  </div>
);
export const GodzillaSocialRight: React.FC<ArtistGodzillaProps> = (props) => (
  <div style={{ ...plane, width: 1952, height: 1666, overflow: "hidden" }}>
    <FontStyles />
    <div style={{ ...plane, width: 976, height: 834, transform: "scale(2)" }}>
      <Scene name="right" props={props} />
    </div>
  </div>
);
/** Shared AE side scenes; exposing them does not change existing Godzilla outputs. */
export const GodzillaSidePanel: React.FC<
  ArtistGodzillaProps & { side: "left" | "right" }
> = ({ side, ...props }) => (
  <div
    style={{
      ...plane,
      width: side === "left" ? 2352 : 1952,
      height: 1666,
      overflow: "hidden",
    }}
  >
    <FontStyles />
    <div
      style={{
        ...plane,
        width: side === "left" ? 1176 : 976,
        height: 834,
        transform: "scale(2)",
      }}
    >
      <Scene name={side} props={props} />
    </div>
  </div>
);
const panelSpecs = [
  { id: "farleft-panel01", width: 2352, x: 0 },
  { id: "centerleft-panel02", width: 4124, x: 2352 },
  { id: "centerright-panel03", width: 4124, x: 6476 },
  { id: "farright-panel04", width: 1952, x: 10600 },
];
const Panel: React.FC<ArtistGodzillaProps & { panelIndex: number }> = ({
  panelIndex,
  ...props
}) => (
  <AbsoluteFill style={{ overflow: "hidden" }}>
    <div
      style={{
        ...plane,
        left: -panelSpecs[panelIndex].x,
        width: 12552,
        height: 1666,
      }}
    >
      <GodzillaMaster {...props} />
    </div>
  </AbsoluteFill>
);

// Four corners in clockwise order, in the 1920x1080 in-situ canvas.
const quad = (p: number[], w: number, h: number) => {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = p;
  const dx1 = x1 - x2,
    dx2 = x3 - x2,
    dx3 = x0 - x1 + x2 - x3,
    dy1 = y1 - y2,
    dy2 = y3 - y2,
    dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det,
    k = (dx1 * dy3 - dx3 * dy1) / det;
  return [
    (x1 - x0 + g * x1) / w,
    (x3 - x0 + k * x3) / h,
    x0,
    (y1 - y0 + g * y1) / w,
    (y3 - y0 + k * y3) / h,
    y0,
    g / w,
    k / h,
    1,
  ];
};
export const GodzillaInSitu: React.FC<ArtistGodzillaProps> = (props) => (
  <AbsoluteFill style={{ background: "black" }}>
    <GodzillaGlass />
    <Img
      src={doohStaticAsset(props.background)}
      style={{ width: 1920, height: 1080 }}
    />
    <div
      style={{
        ...plane,
        width: 2062,
        height: 417,
        left: 959.701975047458 - 1031 * 0.338359000481477,
        top: 293.233134667181 - 208.5 * 0.338359000481477,
        transform: "scale(0.338359000481477)",
      }}
    >
      <div
        style={{
          ...plane,
          width: 2062,
          height: 417,
          filter: "url(#godzilla-reflection-color-v4)",
        }}
      >
        <div
          style={{
            ...plane,
            width: 2062,
            height: 417,
            overflow: "hidden",
            transform: matrix(
              quad(
                [
                  208.219713539753, 116.01138090443, 1841.54808705061,
                  -182.806455025802, 1935.09654536757, 365.740850861008,
                  156.481565656014, 445.429270621893,
                ],
                2062,
                417,
              ),
            ),
          }}
        >
          <div
            style={{
              ...plane,
              left: -588.4185,
              top: 0,
              width: 6276,
              height: 834,
              transform: "scale(.5)",
            }}
          >
            <GodzillaFlat {...props} />
          </div>
        </div>
      </div>
    </div>
    <div
      style={{
        ...plane,
        width: 2062,
        height: 417,
        overflow: "hidden",
        transform: matrix(
          quad(
            [407.02, 423.83, 1512.52, 62.37, 1546.92, 413.26, 390.75, 637.77],
            2062,
            417,
          ),
        ),
      }}
    >
      <div
        style={{
          ...plane,
          left: -588.4185,
          top: 0,
          width: 6276,
          height: 834,
          transform: "scale(.5)",
        }}
      >
        <GodzillaFlat {...props} />
      </div>
    </div>
    <div
      style={{
        ...plane,
        width: 488,
        height: 417,
        overflow: "hidden",
        transform: matrix(
          quad(
            [1504.74, 74.01, 1708.28, 205.51, 1753.2, 496.71, 1538.62, 413.19],
            488,
            417,
          ),
        ),
      }}
    >
      <div
        style={{
          ...plane,
          left: -2650,
          top: 0.5,
          width: 6276,
          height: 834,
          transform: "scale(.5)",
        }}
      >
        <GodzillaFlat {...props} />
      </div>
    </div>
    <Img
      src={doohStaticAsset("assets/godzilla/insitu-foreground.png")}
      style={{
        ...plane,
        width: 1920,
        height: 1080,
        clipPath: "url(#godzilla-outside-canopy-v4)",
      }}
    />
    <Img
      src={doohStaticAsset("assets/godzilla/insitu-foreground.png")}
      style={{
        ...plane,
        width: 1920,
        height: 1080,
        clipPath: "url(#godzilla-canopy-v4)",
        filter: "url(#godzilla-glass-transmission-v4)",
      }}
    />
  </AbsoluteFill>
);

export const GodzillaCompositions = () => (
  <>
    <Composition
      id="artist-godzilla-flat-v10"
      component={GodzillaFlat}
      width={6276}
      height={834}
      fps={60}
      durationInFrames={900}
      defaultProps={godzillaDefaults}
    />
    <Composition
      id="artist-godzilla-master-v10"
      component={GodzillaMaster}
      width={12552}
      height={1666}
      fps={60}
      durationInFrames={900}
      defaultProps={godzillaDefaults}
    />
    {panelSpecs.map((p, i) => (
      <Composition
        key={p.id}
        id={`artist-godzilla-${p.id}-v10`}
        component={Panel}
        width={p.width}
        height={1666}
        fps={60}
        durationInFrames={900}
        defaultProps={{ ...godzillaDefaults, panelIndex: i }}
      />
    ))}
    <Composition
      id="artist-godzilla-insitu-v10"
      component={GodzillaInSitu}
      width={1920}
      height={1080}
      fps={60}
      durationInFrames={900}
      defaultProps={godzillaDefaults}
    />
  </>
);
