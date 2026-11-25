import { doohStaticAsset } from "../doohAssets";
import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  delayRender,
  continueRender,
  cancelRender,
} from "remotion";
import type { ArtistLAProps } from "./ArtistSunsetLA";

/** Dedicated still layout measured from the supplied LA delivery JPG.
 * The reviewed motion's frame 25 is mid-entry and must not be mislabeled a settled still.
 */
export const ArtistLAStatic: React.FC<ArtistLAProps> = (props) => {
  const [handle] = useState(() => delayRender("Load LA static fonts"));
  const [sizes, setSizes] = useState<{
    artist: number;
    song: number;
    pill: number;
  } | null>(null);
  useEffect(() => {
    Promise.all([
      new FontFace(
        "LAStaticDisplay",
        `url("${doohStaticAsset("assets/fonts/YouTubeDisplay-ExtraBold.ttf")}")`,
      ).load(),
      new FontFace(
        "LAStaticRoboto",
        `url("${doohStaticAsset("assets/fonts/Roboto-Medium.ttf")}")`,
      ).load(),
    ])
      .then((fonts) => {
        fonts.forEach((font) => document.fonts.add(font));
        const ctx = document.createElement("canvas").getContext("2d")!;
        const fit = (
          text: string,
          font: string,
          base: number,
          width: number,
        ) => {
          ctx.font = `${base}px ${font}`;
          return Math.min(
            base,
            ...text
              .split("\n")
              .map(
                (line) =>
                  (base * width) / Math.max(1, ctx.measureText(line).width),
              ),
          );
        };
        const lines =
          props.artistName.split("\n").length +
          props.songTitle.split("\n").length;
        const base = Math.min(160, 360 / lines);
        setSizes({
          artist: fit(props.artistName, "LAStaticDisplay", base, 860),
          song: fit(props.songTitle, "LAStaticDisplay", base, 860),
          pill: fit(props.pillCopy, "LAStaticRoboto", 50, 780),
        });
      })
      .catch(cancelRender);
  }, [props.artistName, props.songTitle, props.pillCopy]);
  useEffect(() => {
    if (sizes) continueRender(handle);
  }, [sizes, handle]);
  if (!sizes) return null;
  const songTop = 28 + sizes.artist * props.artistName.split("\n").length + 8;
  const pillTop = Math.max(
    380,
    songTop + sizes.song * props.songTitle.split("\n").length + 45,
  );
  const image = /^(https?:|data:|blob:)/.test(props.featuredArtistImage)
    ? props.featuredArtistImage
    : staticFile(props.featuredArtistImage);
  return (
    <AbsoluteFill style={{ background: "white", color: "#222" }}>
      <Img
        src={image}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1360,
          height: 894,
          objectFit: "cover",
          borderBottomRightRadius: 80,
        }}
      />
      <Img
        src={doohStaticAsset("assets/la-sunset/like.png")}
        style={{
          position: "absolute",
          left: 45,
          top: 732,
          width: 172,
          height: 76,
        }}
      />
      <Img
        src={doohStaticAsset("assets/la-sunset/subscribe.png")}
        style={{
          position: "absolute",
          left: 245,
          top: 732,
          width: 207,
          height: 76,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 846,
          width: 1288,
          height: 8,
          background: "#999",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 846,
          width: 680,
          height: 8,
          background: "#ff0033",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 658,
          top: 828,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#ff0033",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 1398,
          top: 28,
          width: 860,
          fontFamily: "LAStaticDisplay",
          fontSize: sizes.artist,
          lineHeight: 1,
          whiteSpace: "pre",
        }}
      >
        {props.artistName}
      </div>
      <div
        style={{
          position: "absolute",
          left: 1398,
          top: songTop,
          width: 860,
          fontFamily: "LAStaticDisplay",
          fontSize: sizes.song,
          lineHeight: 1,
          whiteSpace: "pre",
          color: props.songTitleColor ?? "#466173",
        }}
      >
        {props.songTitle}
      </div>
      <div
        style={{
          position: "absolute",
          left: 1398,
          top: pillTop,
          maxWidth: 860,
          border: "5px solid #222",
          borderRadius: 18,
          padding: "9px 24px",
          fontFamily: "LAStaticRoboto",
          fontSize: sizes.pill,
          lineHeight: 1.2,
          whiteSpace: "pre",
        }}
      >
        {props.pillCopy}
      </div>
      <Img
        src={doohStaticAsset("assets/la-sunset/logo-black.png")}
        style={{ position: "absolute", left: 1850, top: 810, width: 415 }}
      />
    </AbsoluteFill>
  );
};
