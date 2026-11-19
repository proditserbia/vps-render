import React from "react";
import { ArtistSunsetLAScene } from "./ArtistSunsetLAScene";
import { AbsoluteFill, Composition, Img, staticFile } from "remotion";

export type ArtistLAProps = {
  artistName: string;
  songTitle: string;
  pillCopy: string;
  featuredArtistImage: string;
  featuredVideo: string;
  background: string;
};
export const artistLADefaults: ArtistLAProps = {
  artistName: "Artist Name",
  songTitle: "SONG TITLE",
  pillCopy: "New Single",
  featuredArtistImage: "assets/la-sunset/artist.jpg",
  featuredVideo: "assets/la-sunset/video.mp4",
  background: "assets/la-sunset/background.jpg",
};
const asset = (uri: string) =>
  /^(https?:|data:|blob:)/.test(uri) ? uri : staticFile(uri);

export const ArtistSunsetLA = ArtistSunsetLAScene;
export const ArtistSunsetLAInSitu: React.FC<
  ArtistLAProps & { children?: React.ReactNode }
> = (props) => (
  <AbsoluteFill style={{ background: "#111" }}>
    <Img
      src={asset(props.background)}
      style={{
        position: "absolute",
        width: 2557.44,
        height: 1704.96,
        left: -325.38,
        top: -219.68,
      }}
    />
    {/* AE Corner Pin followed by layer anchor (1152,468), scale 20%, rotation 3 degrees, position (54,-192), and parent scale 111% at (960,544). */}
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 2304,
        height: 936,
        transformOrigin: "0 0",
        transform:
          "matrix3d(0.2999913508,0.0288439576,0,0.0000143020017,0.0009270464,0.3275971283,0,0.00000152914555,0,0,1,0,670.7182761,148.7275016,0,1)",
      }}
    >
      <div style={{ width: 2304, height: 936, position: "relative" }}>
        {props.children ?? <ArtistSunsetLA {...props} />}
      </div>
    </div>
  </AbsoluteFill>
);
export const ArtistLACompositions = () => (
  <>
    <Composition
      id="artist-sunset-la-v1"
      component={ArtistSunsetLA}
      width={2304}
      height={936}
      fps={60}
      durationInFrames={900}
      defaultProps={artistLADefaults}
    />
    <Composition
      id="artist-sunset-la-insitu-v1"
      component={ArtistSunsetLAInSitu}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={450}
      defaultProps={artistLADefaults}
    />
  </>
);
