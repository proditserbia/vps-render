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
} from "remotion";
import measured from "./godzilla-measured-v8.json";
import copyCalibration from "./godzilla-copy-calibration.json";
import sideGraphics from "./godzilla-side-graphics-v8.json";
import { GodzillaGlass } from "./GodzillaGlass";
import { artistLADefaults, type ArtistLAProps } from "./ArtistSunsetLA";

export type ArtistGodzillaProps = ArtistLAProps;
export const godzillaDefaults: ArtistGodzillaProps = {
  ...artistLADefaults,
  background: "assets/godzilla/insitu-background.png",
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
const FontStyles = () => (
  <style>{`
@font-face{font-family:GodzExtra;src:url('${staticFile("assets/fonts/YouTubeDisplay-ExtraBold.ttf")}')}
@font-face{font-family:GodzBold;src:url('${staticFile("assets/fonts/YouTubeDisplay-Bold.ttf")}')}
@font-face{font-family:GodzRoboto;src:url('${staticFile("assets/fonts/Roboto-Medium.ttf")}')}
`}</style>
);

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
      src={staticFile(`assets/la-sunset/logo-${white ? "white" : "black"}.png`)}
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
      src={staticFile("assets/la-sunset/like.png")}
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
        src={staticFile("assets/la-sunset/subscribe.png")}
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
}> = ({ width, y, dot, height = 13 }) => (
  <svg
    width={width}
    height={50}
    style={{ ...plane, top: y - 25, overflow: "visible" }}
  >
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
      stroke="#ff0060"
      strokeWidth={height}
    />
    <circle cx={dot} cy={25} r={height * 1.45} fill="#ff0033" />
  </svg>
);

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
    ? [13, 24, 40]
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
        let h = sample(t, frame);
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
        if (!sideFade && t.length && frame < t[0][0]) {
          const progress = interpolate(
            frame,
            [starts[i], t[0][0]],
            [0, 1],
            clamp,
          );
          h = [...h];
          h[2] -= (1 - progress) * (opening ? 600 : 850);
        }
        const top = opening
          ? [34, 223, 503][i]
          : [48, 209, video ? 440 : 436][i];
        // Homographies are equivalent up to sign, but CSS clips negative w.
        // Normalize around the actual text, not the entire composition origin.
        if (h[6] * (x + 350) + h[7] * (top + 70) + h[8] < 0) {
          h = h.map((v) => -v);
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
            <div
              style={{
                ...plane,
                left: x,
                top,
                color: video ? "white" : i === 1 ? "#142467" : "#202020",
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
            >
              {values[i]}
            </div>
          </div>
        );
      })}
    </>
  );
};

const Scene: React.FC<{
  name: "left" | "center" | "right";
  props: ArtistGodzillaProps;
}> = ({ name, props }) => {
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
  const logoH =
    data.logo?.length && frame >= data.logo[0][0]
      ? sample(data.logo, frame)
      : uiH;
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
  let photoImageH = multiply(photoH, data.photoSource);
  if (center && frame >= 254 && frame <= 270) {
    const invImage = inverse(photoImageH);
    if (invImage[6] * 3500 + invImage[7] * 417 + invImage[8] < 0)
      photoImageH = photoImageH.map((v) => -v);
  }
  const photoBottom = center ? 804 : 646;
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
        background: "white",
      }}
    >
      {center && (
        <MovingCopy data={data} frame={frame} props={props} kind="opening" />
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
                    transform: matrix(data.photoSource),
                    visibility: directPhoto ? "hidden" : "visible",
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
                <Buttons
                  x={center ? 98 : name === "left" ? 49 : 47}
                  y={center ? 581 : name === "left" ? 482 : 485}
                  height={center ? 75 : name === "left" ? 52 : 50}
                />
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
                  height={center ? 20 : 13}
                />
              </div>
            </div>
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
              <Logo x={3700} y={725} width={375} />
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
                <OffthreadVideo
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
                  transform: matrix(logoH),
                }}
              >
                <Logo x={3400} y={72} width={550} white />
              </div>
              <div
                style={{
                  ...plane,
                  width: 4124,
                  height: 834,
                  zIndex: 2,
                  transform: matrix(buttonsH),
                }}
              >
                <Buttons x={3400} y={515} height={105} />
              </div>
            </div>
          )}
        </Sequence>
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
              stroke="#ff0060"
              strokeWidth={26}
            />
            <circle cx={bar[2]} cy={bar[3]} r={38} fill="#ff0033" />
          </svg>
        </div>
      )}
      <MovingCopy
        data={data}
        frame={frame}
        props={props}
        kind={center ? "video" : "side"}
      />
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
                    src={staticFile(`assets/godzilla/${key}-white.png`)}
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
    <Img src={asset(props.background)} style={{ width: 1920, height: 1080 }} />
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
      src={staticFile("assets/godzilla/insitu-foreground.png")}
      style={{
        ...plane,
        width: 1920,
        height: 1080,
        clipPath: "url(#godzilla-outside-canopy-v4)",
      }}
    />
    <Img
      src={staticFile("assets/godzilla/insitu-foreground.png")}
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
      id="artist-godzilla-flat-v8"
      component={GodzillaFlat}
      width={6276}
      height={834}
      fps={60}
      durationInFrames={900}
      defaultProps={godzillaDefaults}
    />
    <Composition
      id="artist-godzilla-master-v8"
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
        id={`artist-godzilla-${p.id}-v8`}
        component={Panel}
        width={p.width}
        height={1666}
        fps={60}
        durationInFrames={900}
        defaultProps={{ ...godzillaDefaults, panelIndex: i }}
      />
    ))}
    <Composition
      id="artist-godzilla-insitu-v8"
      component={GodzillaInSitu}
      width={1920}
      height={1080}
      fps={60}
      durationInFrames={900}
      defaultProps={godzillaDefaults}
    />
  </>
);
