import React, { useState, useEffect } from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
  OffthreadVideo,
  spring,
  delayRender,
  continueRender,
} from 'remotion';
import { SlotProp, AudioSlotProp, ImageSlotProp, VideoSlotProp, cropAnchorToObjectPosition } from '../slotProps';

// ─── Firebase Storage base URL for remote assets ─────────────────────────────
// Fonts and other fixed template assets are served from Firebase Storage instead
// of local static files, making the bundle portable (e.g. AWS Lambda-compatible).
// Update STORAGE_BUCKET when deploying to a different Firebase project.
const STORAGE_BUCKET = 'template-stamper-staging.firebasestorage.app';
function storageUrl(storagePath: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

export interface VeoShortsV1Props {
  gridImage1: SlotProp;
  gridImage2: SlotProp;
  gridImage3: SlotProp;
  gridImage4: SlotProp;
  gridImage5: SlotProp;
  gridImage6: SlotProp;
  gridImage7: SlotProp;
  gridImage8: SlotProp;
  gridImage9: SlotProp;
  selectedImage1: SlotProp;
  selectedImage2: SlotProp;
  promptText: SlotProp;
  generatedVideo: SlotProp;
  /** Optional background audio track. Plays at volume 0.2, fades out over the last ~3.7 s (88 frames / 24 fps). */
  backgroundAudio?: SlotProp;
  /**
   * Pre-rendered endcard video. Rendered full-bleed (cover) for the final
   * 60-frame slot (frames 360–419). Required — job must not reach render without it.
   */
  endCardVideo: SlotProp;
  /**
   * Firebase Storage URL for the loading screen video (loading_h264_24fps_v1.mov).
   * When set, the LoadingScreen uses this remote URL instead of the default
   * Firebase Storage asset URL.
   * Sourced from the template document's `loadingVideoUrl` field.
   */
  loadingVideoUrl?: string;
}

/** Extract a URI from an image or video slot prop, or return empty string. */
function getUri(prop: SlotProp): string {
  if (!prop || prop.type === 'text') return '';
  return prop.uri ?? '';
}

/** Extract a text value from a text slot prop, or return empty string. */
function getText(prop: SlotProp): string {
  if (!prop || prop.type !== 'text') return '';
  return prop.value ?? '';
}

/** Returns true when text contains letters and all such letters belong to Latin script. */
function isLatinScriptText(text: string): boolean {
  const letters = Array.from(text.trim()).filter((char) => /\p{L}/u.test(char));
  if (letters.length === 0) return false;
  return letters.every((char) => /\p{Script=Latin}/u.test(char));
}

/**
 * Format prompt text for the PromptScreen.
 * Caps input at 100 characters. The strip expands dynamically to fit the text
 * on a single line — no line breaks are inserted.
 */
function formatPromptText(text: string): string {
  return text.trim().slice(0, 100);
}

/** Build CSS objectFit value from a slot prop. */
function getObjectFit(prop: SlotProp): 'cover' | 'contain' | 'none' {
  if (!prop || prop.type === 'text' || prop.type === 'audio') return 'cover';
  if (prop.fit_mode === 'contain') return 'contain';
  if (prop.fit_mode === null) return 'none';
  return 'cover';
}

/** Build CSS objectPosition value from a slot prop. */
function getObjectPosition(prop: SlotProp): string {
  if (!prop || prop.type === 'text' || prop.type === 'audio') return 'center center';
  // Both ImageSlotProp and VideoSlotProp carry crop_anchor — narrow via type guard
  const mediaSlot = prop as ImageSlotProp | VideoSlotProp;
  return cropAnchorToObjectPosition(mediaSlot.crop_anchor);
}

/**
 * Scale helper: local reference canvas is 1080×1920, webapp renders at 720×1280.
 * All pixel values from the local Frames are passed through this before use.
 */
const s = (px: number): number => px * (2 / 3);

// ─── Submit button (right-arrow) visual config ────────────────────────────────
// Edit values here to adjust size, position, arrow style, and glow — no need
// to dig through JSX.
const SUBMIT_BUTTON_CONFIG = {
  // ── Size & position ──────────────────────────────────────────────────────
  size: s(145),           // circle button diameter (scaled px)
  containerSize: s(150),  // wrapper div — must be ≥ size to avoid clipping
  rightOffset: s(-10),     // distance from right edge of the prompt strip

  // ── Arrow icon ───────────────────────────────────────────────────────────
  arrowSize: s(110),       // SVG bounding box (scaled px)
  arrowStrokeWidth: 1.5,    // SVG stroke width (viewBox units)
  arrowColor: '#333333',  // SVG stroke colour

  // ── Outer ring / halo (Layer A, rendered as box-shadow behind the circle) ─
  // Edit any value below to adjust outer ring appearance; no JSX edits needed.
  outerRing: {
    innerBlur: 25,            // tight inner shadow blur radius (px)
    outerBlurFactor: 1.2,     // outer ring blur = innerBlur × outerBlurFactor (px)
    outerOpacityFactor: 0.5,  // outer ring opacity = base opacity × this factor
    idleBaseOpacity: 0.1,     // minimum ring opacity while idle
    idlePulseAmplitude: 0.06, // opacity oscillation amplitude during idle pulse
    pressOpacity: 0.4,        // peak ring opacity at press-peak frame
    // Scale / growth: the outer ring follows the same arrowButtonScale × arrowIdleScale
    // transform applied to Layer A (see PromptScreen).  No separate growth constant —
    // the ring expands/contracts identically to the button circle.
  },

  // ── Idle pulse (gentle sine-wave before press) ───────────────────────────
  idlePulse: {
    amplitude: 0.03,   // scale deviation (±3 %)
    frequency: 0.18,   // radians per frame
  },
};
// ─────────────────────────────────────────────────────────────────────────────

// ─── Submit button toggle ─────────────────────────────────────────────────────
// Set to false to hide the right-arrow submit button on Frame2 (PromptScreen)
// for testing.  When false the button is not rendered; layout is unaffected.
const SHOW_SUBMIT_BUTTON = true;
// ─────────────────────────────────────────────────────────────────────────────

// ─── Frame3 (LoadingScreen) disclaimer config ─────────────────────────────────
// Controls timing and position of the disclaimer shown exclusively on Frame3.
// Independent of the Frame1 / Frame2 disclaimer (BottomDisclaimerOverlay).
const FRAME3_DISCLAIMER_CONFIG = {
  startFrame: 120, // first composition frame to show the disclaimer (inclusive)
  endFrame: 149,   // last composition frame to show the disclaimer (inclusive)
  bottom: s(47),   // distance from bottom edge of the frame (scaled px)
};
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads YouTubeDisplay ExtraBold and CJK fallback fonts (Noto Sans KR/JP/base),
 * then pauses rendering until all faces are ready.
 * Font files are fetched from Firebase Storage (not local static files) so the
 * bundle remains portable across environments including AWS Lambda.
 * Must be called in the top-level composition component.
 */
function useFontLoader() {
  const [handle] = useState(() => delayRender('Loading fonts'));

  useEffect(() => {
    const faces = [
      new FontFace(
        'YouTubeDisplay',
        `url(${storageUrl('assets/fonts/YouTubeDisplay-ExtraBold.ttf')})`,
        { weight: '800', style: 'normal' },
      ),
      new FontFace(
        'YouTubeDisplay',
        `url(${storageUrl('assets/fonts/YouTubeDisplay-ExtraBoldItalic.ttf')})`,
        { weight: '800', style: 'italic' },
      ),
	  	  new FontFace(
        'Roboto',
        `url(${storageUrl('assets/fonts/Roboto-Thin.ttf')})`,
        { weight: '100', style: 'normal' },
      ),
	  new FontFace(
        'Roboto',
        `url(${storageUrl('assets/fonts/Roboto-Light.ttf')})`,
        { weight: '300', style: 'normal' },
      ),
      new FontFace(
        'Roboto',
        `url(${storageUrl('assets/fonts/Roboto-Regular.ttf')})`,
        { weight: '400', style: 'normal' },
      ),
      new FontFace(
        'Roboto',
        `url(${storageUrl('assets/fonts/Roboto-Medium.ttf')})`,
        { weight: '500', style: 'normal' },
      ),
      new FontFace(
        'Roboto',
        `url(${storageUrl('assets/fonts/Roboto-Bold.ttf')})`,
        { weight: '700', style: 'normal' },
      ),
      // CJK fallback fonts — required for Korean/Japanese glyphs in the render
      new FontFace(
        'Noto Sans KR',
        `url(${storageUrl('assets/fonts/NotoSansKR-Variable.ttf')})`,
        { weight: '100 900', style: 'normal' },
      ),
      new FontFace(
        'Noto Sans JP',
        `url(${storageUrl('assets/fonts/NotoSansJP-Variable.ttf')})`,
        { weight: '100 900', style: 'normal' },
      ),
      new FontFace(
        'Noto Sans',
        `url(${storageUrl('assets/fonts/NotoSans-Variable.ttf')})`,
        { weight: '100 900', style: 'normal' },
      ),
    ];

    Promise.all(faces.map((f) => f.load()))
      .then((loaded) => {
        loaded.forEach((f) => document.fonts.add(f));
      })
      .finally(() => {
        continueRender(handle);
      });
  }, [handle]);
}

const BottomDisclaimerOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  // Stop before Frame3 takes over — Frame3DisclaimerOverlay handles frames ≥ 120.
  const showSequencesShortened = frame < FRAME3_DISCLAIMER_CONFIG.startFrame;
  const showFeatureDisclaimer  = frame < FRAME3_DISCLAIMER_CONFIG.startFrame;
  const wrapperBottom = showFeatureDisclaimer ? s(10) : s(35);
  const DISCLAIMER_LINE_GAP = s(3);

  if (!showSequencesShortened && !showFeatureDisclaimer) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: wrapperBottom,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: DISCLAIMER_LINE_GAP,
          textAlign: 'center',
        }}
      >
        {showSequencesShortened ? (
          <div
            style={{
              color: '#9aa0a6',
              fontSize: s(30),
              fontFamily: '"Roboto", "Noto Sans KR", "Noto Sans JP", "Noto Sans", Arial, sans-serif',
              fontWeight: 400,
              lineHeight: 0.7,
            }}
          >
            Sequences shortened.
          </div>
        ) : null}
        {showFeatureDisclaimer ? (
          <div
            style={{
              color: '#9aa0a6',
              fontSize: s(30),
              fontFamily: '"Roboto", "Noto Sans KR", "Noto Sans JP", "Noto Sans", Arial, sans-serif',
              fontWeight: 400,
              lineHeight: 1.2,
            }}
          >
            New feature in development, final details may differ.
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ─── Frame3DisclaimerOverlay ──────────────────────────────────────────────────
// Shows ONLY "Sequences shortened." on the LoadingScreen (Frame3).
// Timing and position are controlled exclusively by FRAME3_DISCLAIMER_CONFIG.
// This is completely independent of BottomDisclaimerOverlay.

const Frame3DisclaimerOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < FRAME3_DISCLAIMER_CONFIG.startFrame || frame > FRAME3_DISCLAIMER_CONFIG.endFrame) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: FRAME3_DISCLAIMER_CONFIG.bottom,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            color: '#9aa0a6',
            fontSize: s(30),
            fontFamily: '"Roboto", "Noto Sans KR", "Noto Sans JP", "Noto Sans", Arial, sans-serif',
            fontWeight: 400,
            lineHeight: 0.7,
          }}
        >
          Sequences shortened.
        </div>
      </div>
    </div>
  );
};

// ─── Main composition ────────────────────────────────────────────────────────

export const VeoShortsV1: React.FC<VeoShortsV1Props> = ({
  gridImage1,
  gridImage2,
  gridImage3,
  gridImage4,
  gridImage5,
  gridImage6,
  gridImage7,
  gridImage8,
  gridImage9,
  selectedImage1,
  selectedImage2,
  promptText,
  generatedVideo,
  backgroundAudio,
  endCardVideo,
  loadingVideoUrl,
}) => {
  useFontLoader();

  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Audio fade: matches local MainVideo.tsx — 88 frames before end at 24 fps (was 110 at 30 fps)
  const fadeOutStart = Math.max(0, durationInFrames - 88);
  const audioVolume = interpolate(
    frame,
    [fadeOutStart, durationInFrames],
    [0.2, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const audioSlot = backgroundAudio?.type === 'audio' ? (backgroundAudio as AudioSlotProp) : null;
  const audioUri = audioSlot?.uri ?? null;

  // All sequence timings converted from 30 fps → 24 fps (×24/30 = ×0.8)
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Background audio — optional, null-safe */}
      {audioUri ? <Audio src={audioUri} volume={audioVolume} /> : null}

      {/* Grid Screen — frames 0–59 (0:00–0:02.50) */}
      <Sequence from={0} durationInFrames={60}>
        <GridScreen
          images={[
            gridImage1, gridImage2, gridImage3,
            gridImage4, gridImage5, gridImage6,
            gridImage7, gridImage8, gridImage9,
          ]}
          selectedImage1={selectedImage1}
          selectedImage2={selectedImage2}
        />
      </Sequence>

      {/* Prompt Screen — frames 60–149 (0:02.50–0:06.25).
          Loading overlays the final 30 frames before the generated video begins. */}
      <Sequence from={60} durationInFrames={90}>
        <PromptScreen
          selectedImage1={selectedImage1}
          selectedImage2={selectedImage2}
          promptText={promptText}
        />
      </Sequence>

      {/* Loading Screen — frames 120–149 (0:05.00–0:06.25) */}
      <Sequence from={120} durationInFrames={30}>
        <LoadingScreen src={loadingVideoUrl ?? storageUrl('assets/videos/t1-ingredients-to-video/loading_h264_24fps_v1.mov')} />
      </Sequence>

      {/* Result Screen — frames 150–359 (0:06.25–0:15.00) */}
      <Sequence from={150} durationInFrames={145}>
        <ResultScreen generatedVideo={generatedVideo} />
      </Sequence>

      {/* End Card Screen — frames 360–419 (0:15.00–0:17.50). */}
      <Sequence from={296} durationInFrames={124}>
        <AbsoluteFill>
          <OffthreadVideo
            src={getUri(endCardVideo)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>
      </Sequence>

      <BottomDisclaimerOverlay />
      <Frame3DisclaimerOverlay />
    </AbsoluteFill>
  );
};

// ─── GridScreen (from local Frame1) ──────────────────────────────────────────
//
// Preserves: black background, 3×3 image grid, white-border selection badges
// on cells 3 & 4, animated selected thumbnails at the bottom, Done button with
// press-ripple animation.
// Adaptations: staticFile() paths → slot URIs; pixel values × 2/3;
//              frame numbers converted 30 fps → 24 fps.

const GridScreen: React.FC<{
  images: SlotProp[];
  selectedImage1: SlotProp;
  selectedImage2: SlotProp;
}> = ({ images, selectedImage1, selectedImage2 }) => {
  const frame = useCurrentFrame();

  // Done button press animation (was 43–46–63 at 30 fps)
  const pressStart = 34;
  const pressMin   = 37;
  const pressEnd   = 50;

  const buttonScale = frame <= pressMin
    ? interpolate(frame, [pressStart, pressMin], [1, 0.94], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : interpolate(frame, [pressMin,   pressEnd], [0.94, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const textScale = frame <= pressMin
    ? interpolate(frame, [pressStart, pressMin], [1, 0.92], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : interpolate(frame, [pressMin,   pressEnd], [0.92, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const rippleScale = interpolate(frame, [pressStart, pressEnd], [0, 1.8], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const rippleOpacity = interpolate(
    frame,
    [pressStart, pressMin, pressEnd],
    [0, 1.0, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: 'black', fontFamily: '"YouTubeDisplay", "Noto Sans KR", "Noto Sans JP", "Noto Sans", Arial, sans-serif' }}>

      {/* Header — "Recents ▼" and "×" close button */}
      <div
        style={{
          position: 'absolute',
          top: s(90),
          left: s(145),
          right: s(70),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', color: 'white' }}>
          <div
            style={{
              position: 'absolute',
              left: s(-80),
              top: s(-30),
              transform: 'scale(2.62)',
              transformOrigin: 'left center',
              color: 'white',
              fontSize: s(21.1),
              fontFamily: '"Roboto", "Noto Sans KR", "Noto Sans JP", "Noto Sans", Arial, sans-serif',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            Recents
          </div>
          {/* Dropdown chevron — inline SVG, replaces ⌄ glyph */}
          <svg
            width={s(29)}
            height={s(16)}
            viewBox="0 0 30 18"
            fill="none"
            style={{
              position: 'absolute',
              left: s(145),
              top: s(-28),
              display: 'block',
              overflow: 'visible',
            }}
          >
            <polyline
              points="3,3 15,15 27,3"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        {/* X close icon — inline SVG, replaces × glyph */}
        <svg
          width={s(46)}
          height={s(46)}
          viewBox="0 0 44 44"
          fill="none"
          style={{
            position: 'absolute',
            left: s(830),
            top: s(-38),
            display: 'block',
          }}
        >
          <line x1="5" y1="5" x2="39" y2="39" stroke="white" strokeWidth="4" strokeLinecap="round" />
          <line x1="39" y1="5" x2="5" y2="39" stroke="white" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>

      {/* 3×3 image grid */}
      <div
        style={{
          position: 'absolute',
          top: s(150),
          left: s(15),
          right: s(15),
          bottom: s(15),
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gridTemplateRows: '1fr 1fr 1fr',
          gap: s(15),
        }}
      >
        {images.map((img, i) => {
          // Cells at indices 3 and 4 animate a white selection border + numbered badge
          // (was [10,14] / [15,19] at 30 fps → [8,11] / [12,15] at 24 fps)
          const appearFrame = i === 3 ? 8 : i === 4 ? 12 : null;
          const progress = appearFrame !== null
            ? interpolate(frame, [appearFrame, appearFrame + 3], [0, 1], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              })
            : 0;
          const borderWidth = s(6) * progress;

          return (
            <div
              key={i}
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                borderRadius: s(20),
                backgroundColor: '#111',
                boxSizing: 'border-box',
                border: appearFrame !== null && progress > 0
                  ? `${borderWidth}px solid white`
                  : '0px solid transparent',
              }}
            >
              {getUri(img) ? (
                <Img
                  src={getUri(img)}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: getObjectFit(img),
                    objectPosition: getObjectPosition(img),
                  }}
                />
              ) : null}

              {/* Numbered selection badge (appears on selected cells) */}
              {appearFrame !== null ? (
                <div
                  style={{
                    position: 'absolute',
                    top: s(12),
                    right: s(12),
                    width: s(60),
                    height: s(60),
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'black',
                    fontSize: s(34),
                    fontFamily: '"Roboto", "Noto Sans KR", "Noto Sans JP", "Noto Sans", Arial, sans-serif',
                    fontWeight: 500,
                    lineHeight: 1,
                    transform: `scale(${progress})`,
                    transformOrigin: 'center center',
                    opacity: progress,
                  }}
                >
                  {i === 3 ? 1 : 2}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Black bottom overlay panel (covers lower portion of grid) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: s(400),
          backgroundColor: '#000000',
          zIndex: 15,
        }}
      />

      {/* Selected thumbnail 1 — appears at frame 9 */}
      {getUri(selectedImage1) && frame >= 9 ? (
        <div
          style={{
            position: 'absolute',
            left: s(40),
            bottom: s(240),
            width: s(125),
            height: s(125),
            borderRadius: s(20),
            overflow: 'hidden',
            boxSizing: 'border-box',
            backgroundColor: '#111',
            zIndex: 19,
          }}
        >
          <Img
            src={getUri(selectedImage1)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: getObjectFit(selectedImage1),
              objectPosition: getObjectPosition(selectedImage1),
            }}
          />
        </div>
      ) : null}

      {/* Selected thumbnail 2 — appears at frame 13 */}
      {getUri(selectedImage2) && frame >= 13 ? (
        <div
          style={{
            position: 'absolute',
            left: s(180),
            bottom: s(240),
            width: s(125),
            height: s(125),
            borderRadius: s(20),
            overflow: 'hidden',
            boxSizing: 'border-box',
            backgroundColor: '#111',
            zIndex: 19,
          }}
        >
          <Img
            src={getUri(selectedImage2)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: getObjectFit(selectedImage2),
              objectPosition: getObjectPosition(selectedImage2),
            }}
          />
        </div>
      ) : null}

      {/* Done button + ripple + disclaimer text */}
      <div
        style={{
          position: 'absolute',
          left: s(40),
          right: s(40),
          bottom: s(82),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 20,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '94%',
            height: s(128),
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Button base */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: s(64),
              backgroundColor: '#e5e5e5',
              transform: `scale(${buttonScale})`,
              transformOrigin: 'center center',
              zIndex: 1,
            }}
          />
          {/* Press ripple circle */}
          <div
            style={{
              position: 'absolute',
              width: s(96),
              height: s(96),
              borderRadius: '50%',
              backgroundColor: '#8d8d8d',
              opacity: rippleOpacity,
              transform: `scale(${rippleScale})`,
              transformOrigin: 'center center',
              zIndex: 2,
            }}
          />
          {/* "Done" label */}
          <div
            style={{
              position: 'absolute',
              color: '#000',
              fontSize: s(42),
              fontFamily: '"Roboto", "Noto Sans KR", "Noto Sans JP", "Noto Sans", Arial, sans-serif',
              fontWeight: 500,
              lineHeight: 1,
              transform: `scale(${textScale})`,
              transformOrigin: 'center center',
              zIndex: 3,
            }}
          >
            Done
          </div>
        </div>

      </div>
    </AbsoluteFill>
  );
};

// ─── PromptScreen (from local Frame2) ────────────────────────────────────────
//
// Preserves: sliding black curtain transition, dark panel with selected thumb
// thumbnails, animated typing with blinking caret, arrow submit button with
// press-ripple animation.
// Adaptations: staticFile() → slot URIs; hardcoded prompt text → promptText slot;
//              pixel values × 2/3; frame numbers converted 30 fps → 24 fps.

const SelectedThumb: React.FC<{ slot: SlotProp }> = ({ slot }) => {
  const uri = getUri(slot);
  if (!uri) return null;
  return (
    <div
      style={{
        position: 'relative',
        width: s(320),
        height: s(320),
        borderRadius: s(60),
        overflow: 'hidden',
        // border: `${s(3)}px solid rgba(255,255,255,0.9)`,
        boxSizing: 'border-box',
        backgroundColor: '#111111',
        flexShrink: 0,
      }}
    >
      <Img
        src={uri}
        style={{
          width: '100%',
          height: '100%',
          objectFit: getObjectFit(slot),
          objectPosition: getObjectPosition(slot),
        }}
      />
      {/* × remove badge (UI chrome) */}
      <div
        style={{
          position: 'absolute',
          top: s(35),
          right: s(35),
          width: s(92),
          height: s(92),
          borderRadius: '50%',
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'black',
          fontSize: s(87),
          fontFamily: '"Roboto", "Noto Sans KR", "Noto Sans JP", "Noto Sans", Arial, sans-serif',
          lineHeight: 1,
          fontWeight: 300,
        }}
      >
        ×
      </div>
    </div>
  );
};

const PromptScreen: React.FC<{
  selectedImage1: SlotProp;
  selectedImage2: SlotProp;
  promptText: SlotProp;
}> = ({ selectedImage1, selectedImage2, promptText }) => {
  const frame = useCurrentFrame();

  // Curtain + strip entrance from right (was 0→12 at 30 fps → 0→10 at 24 fps)
  const enterX = interpolate(frame, [0, 10], [s(2400), s(200)], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  // Slide left (was 74→86 → 59→69)
  const slideLeft = interpolate(frame, [59, 69], [0, s(-700)], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const stripX = enterX + slideLeft;

  // Opacity (was [0,6] → [0,5])
  const stripOpacity = interpolate(frame, [0, 5], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Typing animation: typed character-by-character
  // (was typingStart=7, typingEnd=55 → 6, 44)
  const fullText = formatPromptText(getText(promptText));
  const typingStart = 6;
  const typingEnd   = 44;
  const typedCount = Math.floor(
    interpolate(frame, [typingStart, typingEnd], [0, fullText.length], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    }),
  );
  const visibleText = fullText.slice(0, typedCount);
  const isLatinPrompt = isLatinScriptText(fullText);
  // Caret blinks every 8 frames (was 10 at 30 fps)
  const caretVisible = Math.floor(frame / 8) % 2 === 0;

  // Arrow button press animation (was 92–95–108 → 74–76–86)
  const arrowPressStart = 74;
  const arrowPressPeak  = 76;
  const arrowPressEnd   = 86;

  // Idle pulse — gentle sine wave before the press interaction
  const arrowIdleScale = frame < arrowPressStart
    ? 1 + SUBMIT_BUTTON_CONFIG.idlePulse.amplitude * Math.sin(frame * SUBMIT_BUTTON_CONFIG.idlePulse.frequency)
    : 1;

  const arrowButtonScale = frame <= arrowPressPeak
    ? interpolate(frame, [arrowPressStart, arrowPressPeak], [1, 0.94], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : interpolate(frame, [arrowPressPeak,  arrowPressEnd],  [0.94, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const arrowIconScale = frame <= arrowPressPeak
    ? interpolate(frame, [arrowPressStart, arrowPressPeak], [1, 0.92], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : interpolate(frame, [arrowPressPeak,  arrowPressEnd],  [0.92, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Arrow horizontal nudge during press
  const arrowShiftX = interpolate(
    frame,
    [arrowPressStart, arrowPressPeak, arrowPressEnd],
    [0, s(4), 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const arrowRippleScale = interpolate(frame, [arrowPressStart, arrowPressEnd], [0, 1.8], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const arrowRippleOpacity = interpolate(
    frame,
    [arrowPressStart, arrowPressPeak, arrowPressEnd],
    [0, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Outer ring opacity — pulses with idle, intensifies on press
  // Driven by SUBMIT_BUTTON_CONFIG.outerRing.* — edit those constants to tweak.
  const arrowGlowOpacity = frame < arrowPressStart
    ? SUBMIT_BUTTON_CONFIG.outerRing.idleBaseOpacity + SUBMIT_BUTTON_CONFIG.outerRing.idlePulseAmplitude * Math.sin(frame * SUBMIT_BUTTON_CONFIG.idlePulse.frequency)
    : interpolate(
        frame,
        [arrowPressStart, arrowPressPeak, arrowPressEnd],
        [SUBMIT_BUTTON_CONFIG.outerRing.idleBaseOpacity, SUBMIT_BUTTON_CONFIG.outerRing.pressOpacity, SUBMIT_BUTTON_CONFIG.outerRing.idleBaseOpacity],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'transparent',
        fontFamily: '"YouTubeDisplay", "Noto Sans KR", "Noto Sans JP", "Noto Sans", Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Moving black curtain — slides in from right over the grid */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '70%',
          width: s(1950),
          height: '100%',
          backgroundColor: '#0F0F0F',
          transform: `translateX(calc(-50% + ${stripX}px))`,
          zIndex: 20,
        }}
      />

      {/* Moving main prompt strip — width is fit-content so it expands rightward
           with text length while the left edge stays anchored near the frame left */}
      <div
        style={{
          position: 'absolute',
          left: '45%',
          top: '49.5%',
          width: 'fit-content',
          minWidth: s(1500),
          height: s(605),
          borderRadius: s(112),
          backgroundColor: '#212121',
          transform: `translateX(calc(-50% + ${stripX}px)) translateY(-50%)`,
          opacity: stripOpacity,
          boxSizing: 'border-box',
          overflow: 'hidden',
          padding: `${s(48)}px ${s(42)}px ${s(48)}px ${s(42)}px`,
          zIndex: 21,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>

          {/* Left content: selected thumbnails + typing prompt */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: s(35), alignItems: 'center' }}>
              {/* First thumbnail: shifted left so ~25% is cropped by the strip edge */}
              <div style={{ marginLeft: s(-53), flexShrink: 0 }}>
                <SelectedThumb slot={selectedImage1} />
              </div>
              <SelectedThumb slot={selectedImage2} />
            </div>

            <div
              style={{
                marginTop: s(30),
                width: '100%',
                minHeight: s(150),
                borderRadius: s(26),
                backgroundColor: '#212121',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  color: 'white',
                  fontSize: s(60),
                  fontFamily: '"Roboto", "Noto Sans KR", "Noto Sans JP", "Noto Sans", Arial, sans-serif',
                  lineHeight: 1.28,
                  fontWeight: 400,
                  letterSpacing: 1.45,
                  whiteSpace: 'nowrap',
                  marginLeft: s(60),
                  marginTop: s(40),
                }}
              >
                {visibleText}
                {/* Blinking caret */}
                <span
                  style={{
                    display: 'inline-block',
                    width: s(4),
                    height: s(40),
                    marginLeft: s(6),
                    backgroundColor: caretVisible ? '#ff0033' : 'transparent',
                    transform: 'translateY(6px)',
                    borderRadius: s(2),
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right: arrow submit button — controlled by SHOW_SUBMIT_BUTTON toggle */}
          {SHOW_SUBMIT_BUTTON ? (
          <div
            style={{
              position: 'absolute',
              right: SUBMIT_BUTTON_CONFIG.rightOffset,
              top: '88%',
              transform: 'translateY(-50%)',
              width: SUBMIT_BUTTON_CONFIG.containerSize,
              height: SUBMIT_BUTTON_CONFIG.containerSize,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Layer A: outer glow / halo — behind everything */}
            <div
              style={{
                position: 'absolute',
                width: SUBMIT_BUTTON_CONFIG.size,
                height: SUBMIT_BUTTON_CONFIG.size,
                borderRadius: '50%',
                boxShadow: `0 0 ${SUBMIT_BUTTON_CONFIG.outerRing.innerBlur}px rgba(255,255,255,${arrowGlowOpacity}), 0 0 ${SUBMIT_BUTTON_CONFIG.outerRing.innerBlur * SUBMIT_BUTTON_CONFIG.outerRing.outerBlurFactor}px rgba(255,255,255,${arrowGlowOpacity * SUBMIT_BUTTON_CONFIG.outerRing.outerOpacityFactor})`,
                transform: `scale(${arrowButtonScale * arrowIdleScale})`,
                transformOrigin: 'center center',
                zIndex: 0,
              }}
            />
            {/* Layer B: main circular button */}
            <div
              style={{
                position: 'absolute',
                width: SUBMIT_BUTTON_CONFIG.size,
                height: SUBMIT_BUTTON_CONFIG.size,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, #ffffff, #e6e6e6)',
                transform: `scale(${arrowButtonScale * arrowIdleScale})`,
                transformOrigin: 'center center',
                zIndex: 1,
              }}
            />
            {/* Ripple / press-feedback overlay */}
            <div
              style={{
                position: 'absolute',
                width: SUBMIT_BUTTON_CONFIG.size,
                height: SUBMIT_BUTTON_CONFIG.size,
                borderRadius: '50%',
                backgroundColor: '#8d8d8d',
                opacity: arrowRippleOpacity,
                transform: `scale(${arrowRippleScale})`,
                transformOrigin: 'center center',
                zIndex: 2,
              }}
            />
            {/* Layer C: SVG arrow icon — top layer */}
            <div
              style={{
                position: 'absolute',
                width: SUBMIT_BUTTON_CONFIG.arrowSize,
                height: SUBMIT_BUTTON_CONFIG.arrowSize,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `translateX(${arrowShiftX}px) scale(${arrowIconScale * arrowIdleScale})`,
                transformOrigin: 'center center',
                zIndex: 3,
              }}
            >
              <svg
                style={{ width: '100%', height: '100%' }}
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke={SUBMIT_BUTTON_CONFIG.arrowColor}
                  strokeWidth={SUBMIT_BUTTON_CONFIG.arrowStrokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
          ) : null}
        </div>
      </div>

    </AbsoluteFill>
  );
};

// ─── LoadingScreen (from local Frame3) ───────────────────────────────────────
//
// Plays the loading video fullscreen, matching Frame3 faithfully.
// The `src` is supplied by the parent composition — when `loadingVideoUrl` is
// set in the job props (Firebase Storage URL), that is used; otherwise the
// local static file path is used as a fallback for local development.

const LoadingScreen: React.FC<{ src: string }> = ({ src }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black', overflow: 'hidden' }}>
      <OffthreadVideo
        src={src}
        // Asset was authored at 30 fps; Remotion samples it frame-by-frame so the
        // composition fps (24) does not need to match the asset's frame rate.
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </AbsoluteFill>
  );
};

// ─── ResultScreen (from local Frame4) ────────────────────────────────────────
//
// Preserves: video plays fullscreen on white background, then a spring-driven
// shrink + border-radius animation makes it look like a floating card.
// Adaptations: staticFile() → generatedVideo slot; Video → OffthreadVideo for
//              deterministic render-time decoding; pixel values × 2/3.

const ResultScreen: React.FC<{ generatedVideo: SlotProp }> = ({ generatedVideo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Hold fullscreen for ~3 s, then spring-shrink to floating card
  const holdFrames = 3 * fps;

  const shrink = spring({
    frame: Math.max(0, frame - holdFrames),
    fps,
    config: { damping: 18, stiffness: 90, mass: 1 },
    durationInFrames: 34,
  });

  // Subtle settle after the main shrink
  const settle = spring({
    frame: Math.max(0, frame - holdFrames - 8),
    fps,
    config: { damping: 22, stiffness: 120, mass: 0.9 },
    durationInFrames: 18,
  });

  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

  const baseScale   = interpolate(shrink,  [0, 1], [1, 0.785], clamp);
  const settleScale = interpolate(settle,  [0, 1], [1, 0.992], clamp);
  const scale       = baseScale * settleScale;

  // Pixel values scaled from local Frame4 (1080×1920) → webapp (720×1280)
  const borderRadius  = interpolate(shrink, [0, 1], [0, s(46)],  clamp);
  const translateY    = interpolate(shrink, [0, 1], [0, s(-36)], clamp);
  const shadowOpacity = interpolate(shrink, [0, 1], [0, 0.16],   clamp);

  const uri = getUri(generatedVideo);
  const videoSlot = generatedVideo?.type === 'video' ? (generatedVideo as VideoSlotProp) : null;
  const trimStartSeconds = videoSlot?.trim_start_seconds ?? 0;
  const trimFps = videoSlot?.trim_fps ?? fps;
  const trimBefore = Math.round(Math.max(0, trimStartSeconds) * trimFps);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `translateY(${translateY}px) scale(${scale})`,
          overflow: 'hidden',
          borderRadius,
          boxShadow: `0 ${s(18)}px ${s(60)}px rgba(0,0,0,${shadowOpacity})`,
          willChange: 'transform, border-radius',
          position: 'relative',
        }}
      >
        {uri ? (
          <OffthreadVideo
            src={uri}
			volume={0}
            trimBefore={trimBefore}
            style={{
              width: 'calc(100% + 4px)',
              height: 'calc(100% + 4px)',
              objectFit: getObjectFit(generatedVideo),
              objectPosition: getObjectPosition(generatedVideo),
              marginLeft: -2,
              marginTop: -2,
            }}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
