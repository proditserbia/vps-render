import { StreetSocial } from "./StreetSocial";
import { ArtistLAStatic } from "./ArtistLAStatic";
import React from "react";
import { AbsoluteFill, Composition } from "remotion";
import {
  ArtistSunsetLA,
  ArtistSunsetLAInSitu,
  artistLADefaults,
  type ArtistLAProps,
} from "./ArtistSunsetLA";
import {
  GodzillaFlat,
  GodzillaInSitu,
  GodzillaMaster,
  godzillaDefaults,
} from "./ArtistGodzilla";
import outputs from "../usDoohOutputs.json";

type Family = "la" | "ny";
type Input = Record<string, unknown>;
type Output = {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  cropX?: number;
};

export function resolveDoohOutput(family: Family, props: Input): Output {
  const choices: Record<string, Output> = outputs[family];
  const key = props.outputVariant;
  if (typeof key !== "string" || !Object.hasOwn(choices, key)) {
    throw new Error(
      `Unsupported ${family.toUpperCase()} output: ${String(key)}`,
    );
  }
  return choices[key];
}

/** Keep the reviewed animation's plain-string contract separate from app slots. */
export function resolveDoohProps(family: Family, props: Input): ArtistLAProps {
  const slot = (key: string, type: string, field: string): string => {
    const input = props[key];
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error(`Missing ${key}`);
    const value = input as Record<string, unknown>;
    if (
      value.type !== type ||
      typeof value[field] !== "string" ||
      !(value[field] as string).trim()
    )
      throw new Error(`Invalid ${key}`);
    if (field === "uri") {
      if (value.fit_mode && value.fit_mode !== "cover")
        throw new Error(`${key} currently supports cover only`);
      if (value.crop_anchor && value.crop_anchor !== "center")
        throw new Error(`${key} currently supports a centered crop only`);
      if (value.trim_start_seconds)
        throw new Error(
          "Prepare the video clip before uploading; trim offsets are not supported yet",
        );
    }
    return value[field] as string;
  };
  const color = props.songTitleColor === undefined ? undefined : slot("songTitleColor", "text", "value");
  if (color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Invalid song title color");
  const start = props.videoStartMs as {type?:string;value?:number} | undefined;
  if (start !== undefined && (!start || start.type !== "number" || !Number.isSafeInteger(start.value) || start.value! < 0))
    throw new Error("Invalid videoStartMs: use non-negative integer milliseconds");
  return {
    videoStartMs: start?.value ?? 0,
    songTitleColor: color,
    artistName: slot("artistName", "text", "value"),
    songTitle: slot("songTitle", "text", "value"),
    pillCopy: slot("pillCopy", "text", "value"),
    featuredArtistImage: slot("featuredArtistImage", "image", "uri"),
    featuredVideo: slot("featuredVideo", "video", "uri"),
    background:
      family === "la"
        ? artistLADefaults.background
        : godzillaDefaults.background,
  };
}

const Scene: React.FC<{ family: Family; input: Input }> = ({
  family,
  input,
}) => {
  const output = resolveDoohOutput(family, input);
  const props = resolveDoohProps(family, input);
  if (input.outputVariant === "static") return <ArtistLAStatic {...props} />;
  if (input.outputVariant === "static-insitu")
    return (
      <ArtistSunsetLAInSitu {...props}>
        <ArtistLAStatic {...props} />
      </ArtistSunsetLAInSitu>
    );
  if (input.outputVariant === "social")
    return <StreetSocial family={family} props={props} />;
  if (family === "la")
    return input.outputVariant === "insitu" ? (
      <ArtistSunsetLAInSitu {...props} />
    ) : (
      <ArtistSunsetLA {...props} />
    );
  if (input.outputVariant === "insitu") return <GodzillaInSitu {...props} />;
  if (output.cropX !== undefined)
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: -output.cropX,
            top: 0,
            width: 12552,
            height: 1666,
          }}
        >
          <GodzillaMaster {...props} />
        </div>
      </AbsoluteFill>
    );
  return <GodzillaFlat {...props} />;
};
const LA: React.FC<Input> = (props) => <Scene family="la" input={props} />;
const NY: React.FC<Input> = (props) => <Scene family="ny" input={props} />;
const defaults: Input = {
  outputVariant: "flat",
  artistName: { type: "text", value: "Artist Name" },
  songTitle: { type: "text", value: "SONG TITLE" },
  pillCopy: { type: "text", value: "New Single" },
  featuredArtistImage: {
    type: "image",
    uri: artistLADefaults.featuredArtistImage,
  },
  featuredVideo: { type: "video", uri: artistLADefaults.featuredVideo },
};
export const UsDoohTestingCompositions = () => (
  <>
    {(["la", "ny"] as const).map((family) => (
      <Composition
        key={family}
        id={`us-dooh-${family}-test-v1`}
        component={family === "la" ? LA : NY}
        {...outputs[family].flat}
        defaultProps={defaults}
        calculateMetadata={({ props }) => {
          resolveDoohProps(family, props);
          const { width, height, fps, durationInFrames } = resolveDoohOutput(
            family,
            props,
          );
          return { width, height, fps, durationInFrames };
        }}
      />
    ))}
  </>
);
