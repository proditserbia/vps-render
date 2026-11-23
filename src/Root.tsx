import { UsDoohTestingCompositions } from "./compositions/UsDoohTesting";
import { EmpCompositions } from "./compositions/ArtistEMP";
import { MegazillaCompositions } from "./compositions/ArtistMegazilla";
import { ArtistLACompositions } from "./compositions/ArtistSunsetLA";
import { GodzillaCompositions as GodzillaV1Compositions } from "./compositions/ArtistGodzillaV1";
import { GodzillaCompositions as GodzillaV2Compositions } from "./compositions/ArtistGodzillaV2";
import { GodzillaCompositions as GodzillaV3Compositions } from "./compositions/ArtistGodzillaV3";
import { GodzillaCompositions as GodzillaV4Compositions } from "./compositions/ArtistGodzillaV4";
import { GodzillaCompositions as GodzillaV5Compositions } from "./compositions/ArtistGodzillaV5";
import { GodzillaCompositions as GodzillaV6Compositions } from "./compositions/ArtistGodzillaV6";
import { GodzillaCompositions as GodzillaV7Compositions } from "./compositions/ArtistGodzillaV7";
import { GodzillaCompositions as GodzillaV8Compositions } from "./compositions/ArtistGodzillaV8";
import { GodzillaCompositions as GodzillaV9Compositions } from "./compositions/ArtistGodzillaV9";
import { GodzillaCompositions } from "./compositions/ArtistGodzilla";
import React from "react";
import { Composition } from "remotion";
import { VeoShortsV1, VeoShortsV1Props } from "./compositions/VeoShortsV1";
import { AiDreamCatV1, AiDreamCatV1Props } from "./compositions/AiDreamCatV1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComp = React.ComponentType<any>;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <UsDoohTestingCompositions />
      <EmpCompositions />
      <MegazillaCompositions />
      <ArtistLACompositions />
      <GodzillaV1Compositions />
      <GodzillaV2Compositions />
      <GodzillaV3Compositions />
      <GodzillaV4Compositions />
      <GodzillaV5Compositions />
      <GodzillaV6Compositions />
      <GodzillaV7Compositions />
      <GodzillaV8Compositions />
      <GodzillaV9Compositions />
      <GodzillaCompositions />
      <Composition
        id="veo-shorts-v1"
        component={VeoShortsV1 as AnyComp}
        durationInFrames={420} // 17.5 s at 24 fps
        fps={24}
        width={720}
        height={1280}
        defaultProps={
          {
            gridImage1: null,
            gridImage2: null,
            gridImage3: null,
            gridImage4: null,
            gridImage5: null,
            gridImage6: null,
            gridImage7: null,
            gridImage8: null,
            gridImage9: null,
            selectedImage1: null,
            selectedImage2: null,
            promptText: null,
            generatedVideo: null,
            endCardVideo: null,
          } satisfies VeoShortsV1Props
        }
      />

      {/*
        AI Dream Cat V1 — Template 2.
        1080×1920 @ 25 fps, 375 frames (15 seconds).
        New R2 structure: 5s opening, 6s AI drawing, 4s AI result.
        Closing video removed per client request; video ends at AI result.
        Slots: video1-5 (opening videos, count selectable), ai_generated_drawing_video, ai_generated_result_video,
               text1 (editable, max 20 chars), backgroundAudio (optional),
               market (injected from job data for font/asset selection).
        NOTE: No suitable preview video asset exists in the repository.
              Supply video1-5/ai_generated_drawing_video/ai_generated_result_video manually in Remotion Studio to preview locally.
      */}
      <Composition
        id="ai-dream-cat-v1"
        component={AiDreamCatV1 as AnyComp}
        durationInFrames={375}
        fps={25}
        width={1080}
        height={1920}
        defaultProps={
          {
            openingVideoCount: 3,
            video1: null,
            video2: null,
            video3: null,
            video4: null,
            video5: null,
            ai_generated_drawing_video: null,
            ai_generated_result_video: null,
            text1: { type: "text", value: "" },
            backgroundAudio: null,
            dropCardVariant: "drop-card-01",
            market: "global",
          } satisfies AiDreamCatV1Props
        }
      />
    </>
  );
};
