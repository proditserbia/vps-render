import React, { useState, useEffect } from 'react';
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  interpolate,
  delayRender,
  continueRender,
} from 'remotion';
import { VideoSlotProp, TextSlotProp, AudioSlotProp } from '../slotProps';

// ─── Firebase Storage base URL for remote assets ─────────────────────────────
// Same bucket and helper used by VeoShortsV1 — fonts are served from Firebase
// Storage so the bundle stays portable (e.g. AWS Lambda-compatible).
const STORAGE_BUCKET = 'template-stamper-staging.firebasestorage.app';
function storageUrl(storagePath: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

/**
 * Loads CJK fallback fonts (Noto Sans KR / JP / base) from Firebase Storage,
 * then pauses rendering until all faces are ready.
 * Mirrors the font-loading approach used in VeoShortsV1.tsx.
 */
function useFontLoader() {
  const [handle] = useState(() => delayRender('Loading fonts'));

  useEffect(() => {
    const faces = [
      // YouTube Sans — primary font for EN/ID/GLOBAL markets
      new FontFace(
        'YouTube Sans',
        `url(${storageUrl('assets/fonts/YouTubeSans-Bold.ttf')})`,
        { weight: '700', style: 'normal' },
      ),
      // Devanagari display font — primary font for HINDI/IN market user-entered text
      new FontFace(
        'YouTube Display Devanagari One',
        `url(${storageUrl('assets/fonts/YouTubeDisplayDevanagariOne-ExtraBold.ttf')})`,
        { weight: '800', style: 'normal' },
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

// ─── Composition constants ────────────────────────────────────────────────────
const FPS = 25;
const WIDTH = 1080;
const HEIGHT = 1920;

// ─── Timecode → frame reference (all at 25 fps, 15-second composition) ────────
// 00:00:00:00 =  0    00:00:05:00 = 125  00:00:10:00 = 250
// 00:00:01:00 = 25    00:00:06:00 = 150  00:00:12:00 = 300
// 00:00:02:00 = 50    00:00:08:00 = 200  00:00:15:00 = 375

// ─── R2 Structure: 15-second / 375-frame composition ───────────────────────────
// Opening section:   frames 0–149   (150 frames, 6s)
// AI Drawing:        frames 150–274 (125 frames, 5s)
// AI Result:         frames 275–374 (100 frames, 4s)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Opening section: 6 seconds / 150 frames total ──────────────────────────────
const OPENING_START = 0;
const OPENING_END = 149;
const OPENING_TOTAL_FRAMES = 150;

// The opening video count only affects the pre-outline section.
// The selected last opening video always takes over before the fixed red-outline jump.
const OPENING_PRE_OUTLINE_END = 67;
const OPENING_PRE_OUTLINE_TOTAL_FRAMES = OPENING_PRE_OUTLINE_END - OPENING_START + 1;

/**
 * Calculates opening video segment timings for a given count (1–5).
 * Splits the opening section evenly, with remainder distributed to early segments.
 * Pre-outline examples, before the fixed jump at frame 68:
 *   1 video:  68 frames
 *   2 videos: 34 + 34 frames
 *   3 videos: 23 + 23 + 22 frames
 *   4 videos: 17 + 17 + 17 + 17 frames
 *   5 videos: 14 + 14 + 14 + 13 + 13 frames
 *
 * The last selected opening video then continues from its pre-outline segment
 * through frame 149 using the fixed red-outline motion.
 */
function getOpeningSegments(count: number) {
  const safeCount = Math.min(5, Math.max(1, Math.floor(count || 3)));
  const base = Math.floor(OPENING_PRE_OUTLINE_TOTAL_FRAMES / safeCount);
  const remainder = OPENING_PRE_OUTLINE_TOTAL_FRAMES % safeCount;

  let cursor = OPENING_START;
  return Array.from({ length: safeCount }, (_, i) => {
    const duration = base + (i < remainder ? 1 : 0);
    const start = cursor;
    const end = cursor + duration - 1;
    cursor += duration;
    return { start, end, duration };
  });
}

// ─── AI Generated Video timing (new R2 structure) ──────────────────────────────
// The AI-generated section (frames 150–374) is split into two consecutive clips:
//   1. Drawing portion: frames 150–274 (125 frames) — ai_generated_drawing_video
//   2. Result portion:  frames 275–374 (100 frames) — ai_generated_result_video
// Both are standard MP4/MOV full-screen videos (no alpha transparency).
//
// Backward-compat: if the new split props are absent but the old ai_generated_video
// is present, it fills the whole 150–374 range.
const AI_DRAWING_VIDEO_START = 150; // drawing clip begins
const AI_DRAWING_VIDEO_END = 274; // drawing clip ends (inclusive)
const AI_DRAWING_VIDEO_DURATION = AI_DRAWING_VIDEO_END - AI_DRAWING_VIDEO_START + 1; // 125 frames
const AI_RESULT_VIDEO_START = 275;    // result clip begins
const AI_RESULT_VIDEO_END = 374;      // result clip ends (inclusive)
const AI_RESULT_VIDEO_DURATION = AI_RESULT_VIDEO_END - AI_RESULT_VIDEO_START + 1;   // 100 frames
const AI_GENERATED_VIDEO_START = AI_DRAWING_VIDEO_START; // overall AI section start (for fallback path)
const AI_GENERATED_VIDEO_END = AI_RESULT_VIDEO_END;      // overall AI section end (for fallback path)
const AI_GENERATED_VIDEO_DURATION =
  AI_GENERATED_VIDEO_END - AI_GENERATED_VIDEO_START + 1; // 225 frames fallback

// ─── Composition end ──────────────────────────────────────────────────────────
// Video now ends at the AI-generated result (frame 374 inclusive).
// Frames 0–374 = 375 total frames at 25 fps = 15 seconds.
const COMPOSITION_END = 374;

// ─── YouTube Shorts Logo timing ───────────────────────────────────────────────
// Appears near the end of the composition.
// Visible from frame 300 to the end.
const YT_SHORTS_LOGO_START = 300;
const YT_SHORTS_LOGO_DURATION = COMPOSITION_END - YT_SHORTS_LOGO_START + 1; // 75 frames

// Scale: original AE reference normalises 75% full→60% small.
// We treat the 75% display as 100%, so the small scale is 60/75 = 0.8.
const LAST_OPENING_SMALL_SCALE = 0.8;

// Last opening video animation.
// The red outline / shrink transition follows the selected last opening video:
// 1→video1, 2→video2, 3→video3, 4→video4, 5→video5.
//
// Fixed AE-aligned timing, independent from openingVideoCount:
//   - frame 68: instant jump-cut to small red-outline position
//   - frames 68–99: hold small red-outline position
//   - frames 100–110: fixed exit motion back to fullscreen
//   - frames 110–149: fullscreen static hold
const LAST_OPENING_JUMP_TO_OUTLINE_FRAME = 68;
const LAST_OPENING_RETURN_START_FRAME = 100;
const LAST_OPENING_FULLSCREEN_HOLD_FRAMES = 40;
const LAST_OPENING_RETURN_END_FRAME =
  OPENING_END - LAST_OPENING_FULLSCREEN_HOLD_FRAMES + 1; // 110 for 6s opening

// Position when shrunken (top-left anchor of scaled layer).
const LAST_OPENING_SMALL_X = -135;
const LAST_OPENING_SMALL_Y = -22.2;

// Red outline tuning.
// The outline belongs to the same moving/scaling group as the last opening video.
const OUTLINE_COLOR = '#FF0033';
const OUTLINE_WIDTH = 18;
const OUTLINE_RADIUS = 72;
const VIDEO_CORNER_RADIUS = 72;

// Draw outline slightly outside video bounds.
// This keeps it out of frame when scale is 1 and position is 0,0.
const OUTLINE_OFFSET = 14;

// ─── FX Bar fixed template asset ─────────────────────────────────────────────
// Fixed transparent overlay served from Firebase Storage.
// Appears over the last active opening video segment.
// NOT an operator-editable slot — fixed template media only.
const FX_BAR_URI = storageUrl('assets/videos/t2-effects/fx_bar.webm');

// ─── YouTube Shorts logo fixed template asset ────────────────────────────────
// Transparent fixed overlay served from Firebase Storage.
// Appears above ai_generated_video and closing_video starting at frame 300.
// NOT an operator-editable slot — fixed template media only.
const YT_SHORTS_LOGO_URI = storageUrl(
  'assets/videos/t2-effects/yt_shorts_logo.webm'
);

// Click Effects
const CLICK_EFFECTS_AUDIO_URI = storageUrl(
  'assets/videos/t2-effects/click-effects.wav'
);

const BGM_VOLUME = 0.45;
const CLICK_EFFECTS_VOLUME = 0.8;

// ─── FX Bar overlay timing ────────────────────────────────────────────────────
// Fixed absolute timeline, independent from openingVideoCount and red-outline return.
const FX_BAR_START = 68;
const FX_BAR_OUT = 108;
const FX_BAR_DURATION = FX_BAR_OUT - FX_BAR_START + 1;

// ─── Drop Card overlay timing and assets ───────────────────────────────────────
// Fixed absolute timeline and fixed position via the transparent WebM asset.
const DROP_CARD_START = 109;
const DROP_CARD_OUT = 158;
const DROP_CARD_DURATION = DROP_CARD_OUT - DROP_CARD_START + 1;

// Safe allowlist: operator-selectable drop-card variants.
// All WebM format with alpha transparency.
const DROP_CARD_ASSETS = {
  'drop-card-01': 'assets/videos/t2-effects/drop-card-01.webm',
  'drop-card-02': 'assets/videos/t2-effects/drop-card-02.webm',
  'drop-card-03': 'assets/videos/t2-effects/drop-card-03.webm',
  'drop-card-04': 'assets/videos/t2-effects/drop-card-04.webm',
  'drop-card-05': 'assets/videos/t2-effects/drop-card-05.webm',
} as const;

// Phase 1: full-size, centered (matches 1080×1920 canvas origin)
const V2_P1_SCALE = 1.0;
const V2_P1_X = 540;   // center x of 1080 canvas
const V2_P1_Y = 960;   // center y of 1920 canvas

// Phase 2: scaled up + shifted (deliberate hard jump, not interpolated)
const V2_P2_SCALE = 1.33;
const V2_P2_X = 496.7;
const V2_P2_Y = 1136.9;

// ─── Dynamic text badge (shape layer) ────────────────────────────────────────
// Center/anchor position on the 1080×1920 reference canvas.
const BADGE_X = 239.2;
const BADGE_Y = 347.8;
const BADGE_ROTATION = -5; // degrees — applied together with scale inside the badge

// Scale keyframes for the badge overlay.
// TODO: Confirm actual out-point with project owner — reference notes say
//       "visible until 00:00:01:11" (frame 36) but a scale keyframe is specified
//       at 00:00:01:15 (frame 40). We keep the layer visible through frame 40
//       so the scale-down animation completes cleanly.
const BADGE_SCALE_FRAMES = [0, 30, 35, 40] as const;
const BADGE_SCALE_VALUES = [0.82, 0.82, 1.02, 0] as const;
const BADGE_VISIBLE_END = 40; // hide badge after this frame

// Maximum length enforced on text1 — mirrors the metadata slot spec.
const TEXT1_MAX_CHARS = 20;

// ─── Animated text group shared styling ───────────────────────────────────────
const ANIMATED_TEXT_GROUP_ROTATION = -12; // degrees — applied to text2 and text3 containers

// ─── Text2 animation timing (AI Drawing section) ───────────────────────────────
// Animated during the AI drawing portion (frames 125–274).
const TEXT2_START = 156; // start during AI drawing
const TEXT2_POSITION_START = 148;
const TEXT2_POSITION_END = 172;
const TEXT2_POSITION_START_Y = 539.7;
const TEXT2_POSITION_END_Y = 343.8;
const TEXT2_POSITION_X = 404.2;  // x remains constant
const TEXT2_OPACITY_FADE_IN = 156; // fade in early
const TEXT2_OPACITY_VISIBLE = 174; // fully visible
const TEXT2_OPACITY_VISIBLE_END = 229; // remain visible
const TEXT2_OPACITY_FADE_OUT = 240; // fade out before AI Result
const TEXT2_END = 240;

// ─── Text3 animation timing (AI Result section) ──────────────────────────────────
// Animated during the AI result portion (frames 275–374).
const TEXT3_START = 221; // start during AI result
const TEXT3_POSITION_START = 221;
const TEXT3_POSITION_END = 243;
const TEXT3_POSITION_START_Y = 504.2;
const TEXT3_POSITION_END_Y = 308.2;
const TEXT3_POSITION_X = 393.5;  // x remains constant
const TEXT3_OPACITY_FADE_IN = 229; // fade in early in result
const TEXT3_OPACITY_VISIBLE = 245; // fully visible
const TEXT3_OPACITY_VISIBLE_END = 295; // remain visible briefly before CTA
const TEXT3_OPACITY_FADE_OUT = 302; // fade out before CTA starts
const TEXT3_END = 302;

// ─── Text4 animation (red pill element) ───────────────────────────────────────────
// CTA red pill appears near the end of the video (frames 300–374).
const TEXT4_START = 300;        // appear at frame 300
const TEXT4_POSITION_START_X = 538.1;
const TEXT4_POSITION_START_Y = 551.8;
const TEXT4_MOVE_END = 310;     // move animation ends by frame 320
const TEXT4_MOVE_DISTANCE = 140; // pixels upward
const TEXT4_END = COMPOSITION_END; // 374 (restored near-end timing)

// Maximum length for text4
const TEXT4_MAX_CHARS = 20;

// ─── Red pill visual tuning ─────────────────────────────────────────────────
// Manual Y offset to visually center CTA text (negative = shift up).
const RED_PILL_TEXT_Y_OFFSET = 2.5;
const IN_RED_PILL_TEXT_Y_OFFSET = 7.5;
// Drop shadow opacity — client feedback: reduce from ~100% to 30%.
const RED_PILL_SHADOW_OPACITY = 0.3;

// ─── Market-based font mapping ──────────────────────────────────────────────
/**
 * Returns the CSS font-family stack for a given market code.
 * All markets include CJK fallback fonts (Noto Sans KR/JP) to prevent text disappearance
 * when market is Global but content includes Korean/Japanese characters.
 */
function getMarketFontFamily(market?: string): string {
  switch ((market || '').toUpperCase()) {
    case 'KR':
      return '"Noto Sans KR", "YouTube Sans", "Noto Sans", system-ui, sans-serif';
    case 'JP':
      return '"Noto Sans JP", "YouTube Sans", "Noto Sans", system-ui, sans-serif';
    case 'IN':
      return '"YouTube Display Devanagari One", "Noto Sans", "YouTube Sans", system-ui, sans-serif';
    case 'ID':
    case 'EN':
    case 'GLOBAL':
    default:
      return '"YouTube Sans", "Noto Sans KR", "Noto Sans JP", "Noto Sans", system-ui, sans-serif';
  }
}

// ─── Market-specific Dream Cat effect badge assets ──────────────────────────
// Pre-rendered transparent WebM assets per market/language.
// Falls back to the EN asset when market is unknown or 'global'.
const DREAM_CAT_EFFECT_BY_MARKET = {
  KR: 'assets/videos/t2-effects/drop-card-kr.webm',
  ID: 'assets/videos/t2-effects/drop-card-id.webm',
  EN: 'assets/videos/t2-effects/drop-card-en.webm',
  JP: 'assets/videos/t2-effects/drop-card-jp.webm',
  IN: 'assets/videos/t2-effects/drop-card-in.webm',
} as const;

/**
 * Explicit per-variant override map — keyed on the dropCardVariant slot value.
 * Used when the operator manually selects a language from the Effect Icon dropdown.
 */
const DREAM_CAT_EFFECT_BY_VARIANT: Record<string, string> = {
  'dream-cat-kr': 'assets/videos/t2-effects/drop-card-kr.webm',
  'dream-cat-id': 'assets/videos/t2-effects/drop-card-id.webm',
  'dream-cat-en': 'assets/videos/t2-effects/drop-card-en.webm',
  'dream-cat-jp': 'assets/videos/t2-effects/drop-card-jp.webm',
  'dream-cat-in': 'assets/videos/t2-effects/drop-card-in.webm',
};

/**
 * Returns the storage path for the Dream Cat drop-card effect.
 *
 * Resolution order:
 *  1. If `dropCardVariant` is set and not "auto", use the explicit variant map.
 *  2. Otherwise resolve from `market` (normalised to uppercase), falling back to EN.
 */
function getDreamCatEffectPath(market?: string | null, dropCardVariant?: string | null): string {
  if (dropCardVariant && dropCardVariant !== 'auto') {
    return DREAM_CAT_EFFECT_BY_VARIANT[dropCardVariant] ?? DREAM_CAT_EFFECT_BY_MARKET.EN;
  }
  const normalized = (market || '').toUpperCase();
  return (
    DREAM_CAT_EFFECT_BY_MARKET[normalized as keyof typeof DREAM_CAT_EFFECT_BY_MARKET] ??
    DREAM_CAT_EFFECT_BY_MARKET.EN
  );
}

// ─── Badge visual tuning constants ───────────────────────────────────────────
// Adjust these after reference comparison without touching layout logic.
const BADGE_PADDING = '12px 24px 14px';
const BADGE_BORDER_RADIUS = 28;
const BADGE_BORDER = '4px solid rgba(255,255,255,0.95)';
const BADGE_BG = 'rgba(0,0,0,0.08)';
const BADGE_SHADOW = '0 4px 10px rgba(0,0,0,0.45)';
const TEXT_FONT_SIZE = 74;
const TEXT_FONT_WEIGHT = 800;
const TEXT_COLOR = '#ffffff';
const TEXT_FONT_FAMILY = '"Noto Sans KR", "Noto Sans", system-ui, sans-serif';
const TEXT_SHADOW =
  '0 3px 5px rgba(0,0,0,0.75), 1px 0 0 rgba(0,0,0,0.45), -1px 0 0 rgba(0,0,0,0.45), 0 1px 0 rgba(0,0,0,0.45), 0 -1px 0 rgba(0,0,0,0.45)';

// Text optical Y offsets. Positive values move text down, negative values move it up.
// IN/Devanagari uses different font metrics, so these can be tuned independently
// without changing the badge/pill containers or other markets.
const BADGE_TEXT_Y_OFFSET = 0;
const IN_BADGE_TEXT_Y_OFFSET = 7.5;

// ─── Music asset ─────────────────────────────────────────────────────────────
// TODO: "Jolly Cute.wav" has NOT yet been added to the repository.
//       Once the file is placed at:
//         remotion-templates/public/assets/audio/jolly-cute.wav
//       pass it via the backgroundAudio slot prop to hear it here.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Prop types ───────────────────────────────────────────────────────────────

export interface AiDreamCatV1Props {
  /** Number of opening videos to display (1–5). Defaults to 3. */
  openingVideoCount?: number | string;
  /** Uploaded source video for the opening first shot. Visible in opening section. */
  video1: TrimmedVideoSlotProp | null;
  /** Uploaded source video for the second shot. Visible in opening section. */
  video2: TrimmedVideoSlotProp | null;
  /** Uploaded source video for the third shot. Visible in opening section. */
  video3: TrimmedVideoSlotProp | null;
  /** Uploaded source video for the fourth shot (optional). Visible in opening section if openingVideoCount >= 4. */
  video4?: TrimmedVideoSlotProp | null;
  /** Uploaded source video for the fifth shot (optional). Visible in opening section if openingVideoCount = 5. */
  video5?: TrimmedVideoSlotProp | null;
  /** AI screen recording — drawing portion. Visible frames 125–274 (150 frames). */
  ai_generated_drawing_video?: TrimmedVideoSlotProp | null;
  /** AI screen recording — result portion. Visible frames 275–374 (100 frames). */
  ai_generated_result_video?: TrimmedVideoSlotProp | null;
  /** @deprecated Legacy single AI-generated video. Kept as backward-compatible fallback only. */
  ai_generated_video?: TrimmedVideoSlotProp | null;
  /** @deprecated Closing video removed per client request. Kept in interface for backward compat. */
  closing_video?: TrimmedVideoSlotProp | null;
  /** Editable text displayed inside the badge overlay. Max 20 characters. */
  text1: TextSlotProp | string;
  /** Text2: first word of three-word element. [DEPRECATED: Use text2_supers] */
  text2_word1?: TextSlotProp | string;
  /** Text2: second word of three-word element. [DEPRECATED: Use text2_supers] */
  text2_word2?: TextSlotProp | string;
  /** Text2: third word of three-word element. [DEPRECATED: Use text2_supers] */
  text2_word3?: TextSlotProp | string;
  /** Text2: color picker for word 1. Hex color string. [DEPRECATED: Use text2_supers] */
  text2_color1?: string;
  /** Text2: color picker for word 2. Hex color string. [DEPRECATED: Use text2_supers] */
  text2_color2?: string;
  /** Text2: color picker for word 3. Hex color string. [DEPRECATED: Use text2_supers] */
  text2_color3?: string;
  /** Text2 supers: markdown-like syntax with **red text** for red styling and / for linebreaks. Visible during AI Drawing. */
  text2_supers?: TextSlotProp | string;
  /** Text3: first word of two-word element. [DEPRECATED: Use text3_supers] */
  text3_word1?: TextSlotProp | string;
  /** Text3: second word of two-word element. [DEPRECATED: Use text3_supers] */
  text3_word2?: TextSlotProp | string;
  /** Text3: color picker for word 1. Hex color string. [DEPRECATED: Use text3_supers] */
  text3_color1?: string;
  /** Text3: color picker for word 2. Hex color string. [DEPRECATED: Use text3_supers] */
  text3_color2?: string;
  /** Text3 supers: markdown-like syntax with **red text** for red styling and / for linebreaks. Visible during AI Result. */
  text3_supers?: TextSlotProp | string;
  /** Text4: editable text inside red pill shape. CTA near end. */
  text4?: TextSlotProp | string;
  /** Optional background music track (Jolly Cute.wav — file not yet in repo). */
  backgroundAudio?: AudioSlotProp | null;
  /** Optional drop-card overlay variant for video3 section. Defaults to drop-card-01. */
  dropCardVariant?: string | null;
  /** Optional direct URL override for the drop-card overlay asset. */
  dropCardAssetUrl?: string | null;
  /** Market code (e.g. 'KR', 'JP', 'EN', 'ID', 'IN', 'global'). Controls font and effect badge selection. */
  market?: string | null;
}

// ─── Helper functions ─────────────────────────────────────────────────────────

type TrimmedVideoSlotProp = VideoSlotProp & {
  trim_start_seconds?: number;
  trim_duration_frames?: number;
  trim_fps?: number;
};

function getVideoUri(prop: TrimmedVideoSlotProp | null | undefined): string {
  return prop?.uri ?? '';
}

function getTrimStartSeconds(prop: TrimmedVideoSlotProp | string | null | undefined): number {
  if (!prop || typeof prop === 'string') return 0;
  return typeof prop.trim_start_seconds === 'number'
    ? Math.max(0, prop.trim_start_seconds)
    : 0;
}

function getTextValue(prop: TextSlotProp | string | null | undefined, fallback: string): string {
  if (prop == null) return fallback;
  if (typeof prop === 'string') return prop;
  return prop.value ?? fallback;
}

function getAudioUri(prop: AudioSlotProp | null | undefined): string | null {
  if (!prop) return null;
  return prop.uri?.trim() || null;
}

// ─── Supers parser ────────────────────────────────────────────────────────────
type SupersPart = {
  text: string;
  color: string;
};

type SupersLine = SupersPart[];

/**
 * Parses supers syntax for text2_supers/text3_supers.
 *
 * Supported syntax:
 * - **red text** marks red text.
 * - / creates a real visual line break.
 * - Red styling can span across a / line break, e.g. **additional/family**.
 * - Multiple red segments across lines are supported, e.g. **가족** / **구성원인가**요?
 *
 * The parser is language-agnostic: it does not split by words, so Korean,
 * Japanese, Chinese, punctuation, and mixed-language copy remain intact.
 */
function parseSupersLines(supersText: string): SupersLine[] {
  if (!supersText || typeof supersText !== 'string') {
    return [];
  }

  const lines: SupersLine[] = [[]];
  let buffer = '';
  let isRed = false;

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const currentLine = lines[lines.length - 1];
    const color = isRed ? '#FF0000' : '#000000';

    const previousPart = currentLine[currentLine.length - 1];
    if (previousPart && previousPart.color === color) {
      previousPart.text += buffer;
    } else {
      currentLine.push({text: buffer, color});
    }

    buffer = '';
  };

  for (let i = 0; i < supersText.length; i += 1) {
    if (supersText.startsWith('**', i)) {
      flushBuffer();
      isRed = !isRed;
      i += 1;
      continue;
    }

    const char = supersText[i];

    if (char === '/') {
      flushBuffer();

      // The visual design supports two lines. If users add more slash markers,
      // keep the extra content on the second line instead of dropping it.
      if (lines.length < 2) {
        lines.push([]);
      } else {
        buffer += ' ';
      }

      continue;
    }

    buffer += char;
  }

  flushBuffer();

  const trimLineEdges = (line: SupersLine): SupersLine => {
    const parts = line
      .map((part) => ({...part}))
      .filter((part) => part.text.length > 0);

    if (parts.length === 0) return [];

    parts[0].text = parts[0].text.trimStart();
    parts[parts.length - 1].text = parts[parts.length - 1].text.trimEnd();

    return parts.filter((part) => part.text.length > 0);
  };

  return lines
    .map(trimLineEdges)
    .filter((line) => line.length > 0)
    .slice(0, 2);
}

// ─── DynamicTextBadge ─────────────────────────────────────────────────────────

interface DynamicTextBadgeProps {
  text: string;
  scale: number;
  fontFamily?: string;
  textOffsetY?: number;
}

/**
 * Outlined rounded-rectangle badge with white text.
 * Interior is transparent/dark-tinted; white border with soft shadow.
 * The entire group (border + text) scales and rotates from its center.
 * Width expands dynamically to the right with text length via CSS inline-flex layout.
 * All visual values live in the tuning constants above for easy refinement.
 */
const DynamicTextBadge: React.FC<DynamicTextBadgeProps> = ({
  text,
  scale,
  fontFamily,
  textOffsetY = BADGE_TEXT_Y_OFFSET,
}) => (
  <div
    style={{
      transformOrigin: 'center center',
      transform: `scale(${scale}) rotate(${BADGE_ROTATION}deg)`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: BADGE_PADDING,
      borderRadius: BADGE_BORDER_RADIUS,
      border: BADGE_BORDER,
      backgroundColor: BADGE_BG,
      boxShadow: BADGE_SHADOW,
      whiteSpace: 'nowrap',
    }}
  >
    <span
      style={{
        fontSize: TEXT_FONT_SIZE,
        fontWeight: TEXT_FONT_WEIGHT,
        color: TEXT_COLOR,
        fontFamily: fontFamily || TEXT_FONT_FAMILY,
        lineHeight: 1,
        position: 'relative',
        top: textOffsetY,
        textShadow: TEXT_SHADOW,
      }}
    >
      {text}
    </span>
  </div>
);

// ─── Animated Supers Text Element (text2_supers/text3_supers) ────────────────

interface AnimatedSupersTextProps {
  frame: number;
  lines: SupersLine[];
  posStartY: number;
  posEndY: number;
  posX: number;
  posStartFrame: number;
  posEndFrame: number;
  opacityFadeInFrame: number;
  opacityVisibleFrame: number;
  opacityVisibleEndFrame: number;
  opacityFadeOutFrame: number;
  fontFamily?: string;
  compactLeading?: boolean;
}

const AnimatedSupersText: React.FC<AnimatedSupersTextProps> = ({
  frame,
  lines,
  posStartY,
  posEndY,
  posX,
  posStartFrame,
  posEndFrame,
  opacityFadeInFrame,
  opacityVisibleFrame,
  opacityVisibleEndFrame,
  opacityFadeOutFrame,
  fontFamily,
  compactLeading = false,
}) => {
  const posY = interpolate(
    frame,
    [posStartFrame, posEndFrame],
    [posStartY, posEndY],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const opacity = interpolate(
    frame,
    [opacityFadeInFrame, opacityVisibleFrame, opacityVisibleEndFrame, opacityFadeOutFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // EN and Indonesian copy uses Latin script and matches the reference better
  // with tighter two-line leading. Keep KR/JP/IN on normal spacing to avoid glyph clipping.
  const supersLineHeight = compactLeading ? 0.84 : 1;
  const supersLineGap = compactLeading ? '-8px' : '4px';

  return (
    <div
      style={{
        position: 'absolute',
        left: posX,
        top: posY,
        transform: `translate(-50%, -50%) rotate(${ANIMATED_TEXT_GROUP_ROTATION}deg)`,
        opacity,
        textAlign: 'center',
      }}
    >
      {lines.map((line, lineIndex) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={`supers-line-${lineIndex}`}
          style={{
            display: 'block',
            whiteSpace: 'pre-wrap',
            lineHeight: supersLineHeight,
            marginBottom: lineIndex < lines.length - 1 ? supersLineGap : 0,
          }}
        >
          {line.map((part, partIndex) => (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={`supers-part-${lineIndex}-${partIndex}`}
              style={{
                fontSize: 74,
                fontWeight: 700,
                color: part.color,
                fontFamily: fontFamily || TEXT_FONT_FAMILY,
                lineHeight: supersLineHeight,
              }}
            >
              {part.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

// ─── Animated Text Element (text2, text3 style) ────────────────────────────────

interface AnimatedTextElementProps {
  frame: number;
  word1: string;
  word2: string;
  color1: string;
  color2: string;
  posStartY: number;
  posEndY: number;
  posX: number;
  posStartFrame: number;
  posEndFrame: number;
  opacityFadeInFrame: number;
  opacityVisibleFrame: number;
  opacityVisibleEndFrame: number;
  opacityFadeOutFrame: number;
  fontFamily?: string;
}

const AnimatedTextElement: React.FC<AnimatedTextElementProps> = ({
  frame,
  word1,
  word2,
  color1,
  color2,
  posStartY,
  posEndY,
  posX,
  posStartFrame,
  posEndFrame,
  opacityFadeInFrame,
  opacityVisibleFrame,
  opacityVisibleEndFrame,
  opacityFadeOutFrame,
  fontFamily,
}) => {
  // Position animation (vertical movement only)
  const posY = interpolate(
    frame,
    [posStartFrame, posEndFrame],
    [posStartY, posEndY],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Opacity animation
  const opacity = interpolate(
    frame,
    [opacityFadeInFrame, opacityVisibleFrame, opacityVisibleEndFrame, opacityFadeOutFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: posX,
        top: posY,
        transform: `translate(-50%, -50%) rotate(${ANIMATED_TEXT_GROUP_ROTATION}deg)`,
        opacity,
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 74,
            fontWeight: 700,
            color: color1,
            fontFamily: fontFamily || TEXT_FONT_FAMILY,
            lineHeight: 1,
          }}
        >
          {word1}
        </span>
        <span
          style={{
            fontSize: 74,
            fontWeight: 700,
            color: color2,
            fontFamily: fontFamily || TEXT_FONT_FAMILY,
            lineHeight: 1,
          }}
        >
          {word2}
        </span>
      </div>
    </div>
  );
};

// ─── Animated Text Element with 3 words (text2 style) ───────────────────────────

interface AnimatedText3WordProps {
  frame: number;
  word1: string;
  word2: string;
  word3: string;
  color1: string;
  color2: string;
  color3: string;
  posStartY: number;
  posEndY: number;
  posX: number;
  posStartFrame: number;
  posEndFrame: number;
  opacityFadeInFrame: number;
  opacityVisibleFrame: number;
  opacityVisibleEndFrame: number;
  opacityFadeOutFrame: number;
  fontFamily?: string;
}

const AnimatedText3Word: React.FC<AnimatedText3WordProps> = ({
  frame,
  word1,
  word2,
  word3,
  color1,
  color2,
  color3,
  posStartY,
  posEndY,
  posX,
  posStartFrame,
  posEndFrame,
  opacityFadeInFrame,
  opacityVisibleFrame,
  opacityVisibleEndFrame,
  opacityFadeOutFrame,
  fontFamily,
}) => {
  // Position animation (vertical movement only)
  const posY = interpolate(
    frame,
    [posStartFrame, posEndFrame],
    [posStartY, posEndY],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Opacity animation
  const opacity = interpolate(
    frame,
    [opacityFadeInFrame, opacityVisibleFrame, opacityVisibleEndFrame, opacityFadeOutFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: posX,
        top: posY,
        transform: `translate(-50%, -50%) rotate(${ANIMATED_TEXT_GROUP_ROTATION}deg)`,
        opacity,
        textAlign: 'center',
      }}
    >
      {/* First line: word1 and word2 */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '4px' }}>
        <span
          style={{
            fontSize: 74,
            fontWeight: 700,
            color: color1,
            fontFamily: fontFamily || TEXT_FONT_FAMILY,
            lineHeight: 1,
          }}
        >
          {word1}
        </span>
        <span
          style={{
            fontSize: 74,
            fontWeight: 700,
            color: color2,
            fontFamily: fontFamily || TEXT_FONT_FAMILY,
            lineHeight: 1,
          }}
        >
          {word2}
        </span>
      </div>
      {/* Second line: word3 */}
      <div>
        <span
          style={{
            fontSize: 74,
            fontWeight: 700,
            color: color3,
            fontFamily: fontFamily || TEXT_FONT_FAMILY,
            lineHeight: 1,
          }}
        >
          {word3}
        </span>
      </div>
    </div>
  );
};

// ─── Red Pill Element (text4) ──────────────────────────────────────────────────

interface RedPillProps {
  frame: number;
  text: string;
  startX: number;
  startY: number;
  moveDistance: number;
  moveEndFrame: number;
  startFrame: number;
  endFrame: number;
  fontFamily?: string;
  textOffsetY?: number;
}

const RedPill: React.FC<RedPillProps> = ({
  frame,
  text,
  startX,
  startY,
  moveDistance,
  moveEndFrame,
  startFrame,
  endFrame,
  fontFamily,
  textOffsetY = RED_PILL_TEXT_Y_OFFSET,
}) => {
  // Upward movement from startFrame to moveEndFrame
  const offsetY = interpolate(
    frame,
    [startFrame, moveEndFrame],
    [0, -moveDistance],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Visibility: visible from startFrame to endFrame
  const opacity = frame >= startFrame && frame <= endFrame ? 1 : 0;

  const PILL_PADDING = '20px 50px';
  const PILL_RADIUS = 64;
  const PILL_BG = '#FF0033';
  const PILL_SHADOW = `0 0 64px rgba(0, 0, 0, ${RED_PILL_SHADOW_OPACITY}), 0 0 64px rgba(0, 0, 0, ${RED_PILL_SHADOW_OPACITY})`;
  const PILL_TEXT_COLOR = '#FFFFFF';
  const PILL_FONT_SIZE = 58;
  const PILL_FONT_WEIGHT = 700;

  return (
    <div
      style={{
        position: 'absolute',
        left: startX,
        top: startY + offsetY,
        transform: 'translate(-50%, -50%)',
        opacity,
        transition: opacity === 0 ? 'none' : undefined,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: PILL_PADDING,
          borderRadius: PILL_RADIUS,
          backgroundColor: PILL_BG,
          boxShadow: PILL_SHADOW,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            fontSize: PILL_FONT_SIZE,
            fontWeight: PILL_FONT_WEIGHT,
            color: PILL_TEXT_COLOR,
            fontFamily: fontFamily || TEXT_FONT_FAMILY,
            lineHeight: 1,
            position: 'relative',
            top: textOffsetY,
          }}
        >
          {text.slice(0, TEXT4_MAX_CHARS)}
        </span>
      </div>
    </div>
  );
};

// ─── Main composition ─────────────────────────────────────────────────────────

export const AiDreamCatV1: React.FC<AiDreamCatV1Props> = ({
  openingVideoCount,
  video1,
  video2,
  video3,
  video4,
  video5,
  ai_generated_drawing_video,
  ai_generated_result_video,
  ai_generated_video,
  text1,
  text2_supers,
  text2_word1,
  text2_word2,
  text2_word3,
  text2_color1,
  text2_color2,
  text2_color3,
  text3_supers,
  text3_word1,
  text3_word2,
  text3_color1,
  text3_color2,
  text4,
  backgroundAudio,
  dropCardVariant,
  dropCardAssetUrl,
  market,
}) => {
  useFontLoader();
  const frame = useCurrentFrame();

  // ── Resolve market-based font family ──────────────────────────────────────
  const marketFontFamily = getMarketFontFamily(market ?? undefined);
  const marketCode = (market || '').toUpperCase();
  const isHindiMarket = marketCode === 'IN';
  const badgeTextYOffset = isHindiMarket ? IN_BADGE_TEXT_Y_OFFSET : BADGE_TEXT_Y_OFFSET;
  const redPillTextYOffset = isHindiMarket ? IN_RED_PILL_TEXT_Y_OFFSET : RED_PILL_TEXT_Y_OFFSET;

  // EN and Indonesia need tighter two-line leading in supers text.
  const compactSupersLeading = ['EN', 'GLOBAL', 'ID'].includes(marketCode);

  // ── Compute opening video segments based on openingVideoCount ─────────────
  // Metadata select values arrive as strings, so parse defensively.
  const parsedOpeningCount = Number.parseInt(String(openingVideoCount ?? '3'), 10);
  const safeOpeningCount = Number.isFinite(parsedOpeningCount)
    ? Math.min(5, Math.max(1, parsedOpeningCount))
    : 3;
  const openingSegments = getOpeningSegments(safeOpeningCount);
  const lastOpeningIndex = openingSegments.length - 1;
  const lastOpeningSegment = openingSegments[lastOpeningIndex];

  // ── Collect opening video props into an array for dynamic access ─────────
  const openingVideoProps = [video1, video2, video3, video4, video5];

  // ── Resolve slot values ────────────────────────────────────────────────────
  const video1Uri = getVideoUri(video1);
  const video2Uri = getVideoUri(video2);
  const video3Uri = getVideoUri(video3);
  const video4Uri = getVideoUri(video4);
  const video5Uri = getVideoUri(video5);
  const video1SourceStartFrame = Math.round(getTrimStartSeconds(video1) * FPS);
  const video2SourceStartFrame = Math.round(getTrimStartSeconds(video2) * FPS);
  const video3SourceStartFrame = Math.round(getTrimStartSeconds(video3) * FPS);
  const video4SourceStartFrame = Math.round(getTrimStartSeconds(video4) * FPS);
  const video5SourceStartFrame = Math.round(getTrimStartSeconds(video5) * FPS);

  // ── AI Generated Video: split or fallback ────────────────────────────────
  // If either new split slot is provided, use the two-clip path.
  // Otherwise fall back to the legacy single-slot path.
  const useNewAiSlots =
    getVideoUri(ai_generated_drawing_video ?? null) !== '' ||
    getVideoUri(ai_generated_result_video ?? null) !== '';

  const ai_drawing_videoUri = useNewAiSlots ? getVideoUri(ai_generated_drawing_video ?? null) : '';
  const ai_result_videoUri = useNewAiSlots ? getVideoUri(ai_generated_result_video ?? null) : '';
  const ai_drawing_sourceStartFrame = Math.round(getTrimStartSeconds(ai_generated_drawing_video) * FPS);
  const ai_result_sourceStartFrame = Math.round(getTrimStartSeconds(ai_generated_result_video) * FPS);

  const ai_generated_videoUri = useNewAiSlots ? '' : getVideoUri(ai_generated_video ?? null);
  const ai_generated_videoSourceStartFrame = useNewAiSlots
    ? 0
    : Math.round(getTrimStartSeconds(ai_generated_video) * FPS);
  const rawText = getTextValue(text1, '심소빵');
  const badgeText = rawText.slice(0, TEXT1_MAX_CHARS);
   
  // ── Text2/Text3 supers extraction ──────────────────────────────────────────
  // New metadata uses text2_supers/text3_supers with **red text** and / linebreaks.
  // Old word/color props remain as fallback only for older jobs.
  const text2SupersValue = getTextValue(text2_supers, '');
  const text2SupersLines = text2SupersValue ? parseSupersLines(text2SupersValue) : [];
  const hasText2Supers = text2SupersLines.length > 0;

  const text3SupersValue = getTextValue(text3_supers, '');
  const text3SupersLines = text3SupersValue ? parseSupersLines(text3SupersValue) : [];
  const hasText3Supers = text3SupersLines.length > 0;

  // ── Legacy Text2/Text3 extraction fallback ────────────────────────────────
  const text2Word1 = getTextValue(text2_word1, '').slice(0, TEXT1_MAX_CHARS);
  const text2Word2 = getTextValue(text2_word2, '').slice(0, TEXT1_MAX_CHARS);
  const text2Word3 = getTextValue(text2_word3, '').slice(0, TEXT1_MAX_CHARS);
  const text2Color1 = text2_color1 ?? '#000000';
  const text2Color2 = text2_color2 ?? '#FF0000';
  const text2Color3 = text2_color3 ?? '#000000';

  const text3Word1 = getTextValue(text3_word1, '').slice(0, TEXT1_MAX_CHARS);
  const text3Word2 = getTextValue(text3_word2, '').slice(0, TEXT1_MAX_CHARS);
  const text3Color1 = text3_color1 ?? '#000000';
  const text3Color2 = text3_color2 ?? '#FF0000';

  // ── Text4 (red pill element) extraction ───────────────────────────────────
  const text4Value = getTextValue(text4, '').slice(0, TEXT4_MAX_CHARS);
  
  const audioUri = getAudioUri(backgroundAudio);

  // ── Drop card overlay resolution (market-aware, variant override) ────────────
  // Resolves from dropCardVariant when manually set; falls back to market-based auto.
  const dropCardOverlayUri = dropCardAssetUrl || storageUrl(getDreamCatEffectPath(market, dropCardVariant));

  // ── Last opening video animation helpers ───────────────────────────────
  const getLastOpeningMotion = () => {
    const jumpToOutlinedFrame = Math.min(
      OPENING_END,
      Math.max(OPENING_START, LAST_OPENING_JUMP_TO_OUTLINE_FRAME),
    );

    const returnStart = Math.min(
      OPENING_END - 1,
      Math.max(jumpToOutlinedFrame + 1, LAST_OPENING_RETURN_START_FRAME),
    );

    // First clean fullscreen frame after the fixed exit motion.
    const safeReturnEnd = Math.min(
      OPENING_END,
      Math.max(returnStart + 1, LAST_OPENING_RETURN_END_FRAME),
    );

    let scale = 1;
    let x = 0;
    let y = 0;
    let cornerRadius = 0;

    if (frame < jumpToOutlinedFrame) {
      // Normal fullscreen phase.
      scale = 1;
      x = 0;
      y = 0;
      cornerRadius = 0;
    } else if (frame < returnStart) {
      // Instant jump-cut to final red-outline/small position and hold.
      scale = LAST_OPENING_SMALL_SCALE;
      x = LAST_OPENING_SMALL_X;
      y = LAST_OPENING_SMALL_Y;
      cornerRadius = VIDEO_CORNER_RADIUS;
    } else {
      // Fixed exit motion only: small outlined card → fullscreen.
      scale = interpolate(
        frame,
        [returnStart, safeReturnEnd],
        [LAST_OPENING_SMALL_SCALE, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );

      x = interpolate(
        frame,
        [returnStart, safeReturnEnd],
        [LAST_OPENING_SMALL_X, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );

      y = interpolate(
        frame,
        [returnStart, safeReturnEnd],
        [LAST_OPENING_SMALL_Y, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );

      cornerRadius = interpolate(
        frame,
        [returnStart, safeReturnEnd],
        [VIDEO_CORNER_RADIUS, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );
    }

    // Outline is visible only while the layer is small/returning.
    // At safeReturnEnd it is clean fullscreen.
    const outlineOpacity =
      frame >= jumpToOutlinedFrame && frame < safeReturnEnd ? 1 : 0;

    return {
      scale,
      x,
      y,
      cornerRadius,
      outlineOpacity,
      shrinkStart: jumpToOutlinedFrame,
      shrinkEnd: jumpToOutlinedFrame,
      returnStart,
      returnEnd: safeReturnEnd,
    };
  };

  const lastOpeningMotion = getLastOpeningMotion();

  // Fixed overlays: absolute timing, independent from openingVideoCount.
  const fxBarStart = FX_BAR_START;
  const fxBarDuration = FX_BAR_DURATION;

  const dropCardStart = DROP_CARD_START;
  const dropCardDuration = DROP_CARD_DURATION;

  // ── Badge scale animation ──────────────────────────────────────────────────
  const badgeScale = interpolate(
    frame,
    [...BADGE_SCALE_FRAMES],
    [...BADGE_SCALE_VALUES],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const badgeVisible = frame <= BADGE_VISIBLE_END;

  return (
    <AbsoluteFill style={{ backgroundColor: '#ffffff', overflow: 'hidden' }}>

      {/* ── Dynamic Opening Videos: based on openingVideoCount ─────────────────── */}
      {/* Render pre-outline segments; the selected last video continues through the fixed red-outline timeline. */}
      {openingSegments.map((segment, idx) => {
        const videoProp = openingVideoProps[idx];
        const videoUri = videoProp ? getVideoUri(videoProp) : '';
        const videoSourceStartFrame = videoProp ? Math.round(getTrimStartSeconds(videoProp) * FPS) : 0;

        if (!videoUri) return null;

        // The selected last opening video is the only clip that continues through
        // the fixed red-outline timeline. Earlier videos only fill the pre-outline section.

        const isFirstVideo = idx === 0;
        const isSecondVideo = idx === 1;
        const isLastOpeningVideo = idx === lastOpeningIndex;

        if (isLastOpeningVideo) {
          const motion = lastOpeningMotion;

          return (
            <Sequence
              key={`opening-video-${idx}`}
              from={segment.start}
              durationInFrames={OPENING_END - segment.start + 1}
            >
              {frame >= segment.start && frame <= OPENING_END && videoUri ? (
                <div
                  style={{
                    position: 'absolute',
                    left: motion.x,
                    top: motion.y,
                    width: WIDTH,
                    height: HEIGHT,
                    transform: `scale(${motion.scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  {/* White base plate behind the moving framed video */}
                  <div
                    style={{
                      position: 'absolute',
                      left: -OUTLINE_OFFSET,
                      top: -OUTLINE_OFFSET,
                      width: WIDTH + OUTLINE_OFFSET + OUTLINE_WIDTH,
                      height: HEIGHT + OUTLINE_OFFSET + OUTLINE_WIDTH,
                      backgroundColor: '#ffffff',
                      borderRadius: OUTLINE_RADIUS,
                      opacity: motion.outlineOpacity,
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Red outline plate */}
                  <div
                    style={{
                      position: 'absolute',
                      left: -OUTLINE_OFFSET,
                      top: -OUTLINE_OFFSET,
                      width: WIDTH + OUTLINE_OFFSET + OUTLINE_WIDTH,
                      height: HEIGHT + OUTLINE_OFFSET + OUTLINE_WIDTH,
                      backgroundColor: OUTLINE_COLOR,
                      borderRadius: OUTLINE_RADIUS,
                      boxSizing: 'border-box',
                      opacity: motion.outlineOpacity,
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Clipped video with rounded corners */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: WIDTH,
                      height: HEIGHT,
                      overflow: 'hidden',
                      borderRadius: motion.cornerRadius,
                    }}
                  >
                    <OffthreadVideo
                      src={videoUri}
                      muted
                      trimBefore={videoSourceStartFrame}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: WIDTH,
                        height: HEIGHT,
                        objectFit: 'cover',
                        objectPosition: 'center center',
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </Sequence>
          );
        }

        if (isFirstVideo && (safeOpeningCount === 2 || safeOpeningCount === 3)) {
          // Apply video 1 zoom animation (scale 155% → 100% over first 3 frames)
          const videoScale = interpolate(
            frame,
            [segment.start, segment.start + 3],
            [1.55, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          
          return (
            <Sequence key={`opening-video-${idx}`} from={segment.start} durationInFrames={segment.duration}>
              {frame <= segment.end && videoUri ? (
                <AbsoluteFill
                  style={{
                    transform: `scale(${videoScale})`,
                    transformOrigin: 'center center',
                  }}
                >
                  <OffthreadVideo
                    src={videoUri}
                    muted
                    trimBefore={videoSourceStartFrame}
                    style={{
                      width: WIDTH,
                      height: HEIGHT,
                      objectFit: 'cover',
                      objectPosition: 'center center',
                    }}
                  />
                </AbsoluteFill>
              ) : null}
            </Sequence>
          );
        }

        if (isSecondVideo && safeOpeningCount === 2) {
          // For 2 videos, render second video as full-screen
          return (
            <Sequence key={`opening-video-${idx}`} from={segment.start} durationInFrames={segment.duration}>
              {frame >= segment.start && frame <= segment.end && videoUri ? (
                <AbsoluteFill>
                  <OffthreadVideo
                    src={videoUri}
                    muted
                    trimBefore={videoSourceStartFrame}
                    style={{
                      width: WIDTH,
                      height: HEIGHT,
                      objectFit: 'cover',
                      objectPosition: 'center center',
                    }}
                  />
                </AbsoluteFill>
              ) : null}
            </Sequence>
          );
        }

        if (isSecondVideo && (safeOpeningCount === 3 || safeOpeningCount === 4 || safeOpeningCount === 5)) {
          // For 3+ videos, render second video with phase-based scaling (simplified)
          const isPhase2 = frame >= segment.start + Math.floor(segment.duration / 2);
          const videoScale = isPhase2 ? V2_P2_SCALE : V2_P1_SCALE;
          const videoX = isPhase2 ? V2_P2_X : V2_P1_X;
          const videoY = isPhase2 ? V2_P2_Y : V2_P1_Y;

          return (
            <Sequence key={`opening-video-${idx}`} from={segment.start} durationInFrames={segment.duration}>
              {frame >= segment.start && frame <= segment.end && videoUri ? (
                <AbsoluteFill
                  style={{
                    transform: `scale(${videoScale})`,
                    transformOrigin: `${videoX}px ${videoY}px`,
                  }}
                >
                  <OffthreadVideo
                    src={videoUri}
                    muted
                    trimBefore={videoSourceStartFrame}
                    style={{
                      width: WIDTH,
                      height: HEIGHT,
                      objectFit: 'cover',
                      objectPosition: 'center center',
                    }}
                  />
                </AbsoluteFill>
              ) : null}
            </Sequence>
          );
        }


        // For all other videos (4, 5) or if not matched above, render full-screen
        return (
          <Sequence key={`opening-video-${idx}`} from={segment.start} durationInFrames={segment.duration}>
            {frame >= segment.start && frame <= segment.end && videoUri ? (
              <AbsoluteFill>
                <OffthreadVideo
                  src={videoUri}
                  muted
                  trimBefore={videoSourceStartFrame}
                  style={{
                    width: WIDTH,
                    height: HEIGHT,
                    objectFit: 'cover',
                    objectPosition: 'center center',
                  }}
                />
              </AbsoluteFill>
            ) : null}
          </Sequence>
        );
      })}


      {/* ── FX Bar overlay: fixed transparent asset on absolute timing ─────────── */}
      {/* Fixed 68–108 timing. Not operator-editable. */}
      <Sequence from={fxBarStart} durationInFrames={fxBarDuration}>
        <OffthreadVideo
          src={FX_BAR_URI}
		  muted
          transparent
          style={{
            position: 'absolute',
            width: WIDTH,
            height: HEIGHT,
            objectFit: 'cover',
          }}
        />
      </Sequence>

      {/* ── Drop Card overlay: transparent selected variant on fixed timing ────── */}
      {/* Fixed 109–158 timing and fixed position in the asset. */}
      <Sequence from={dropCardStart} durationInFrames={dropCardDuration}>
        <OffthreadVideo
          src={dropCardOverlayUri}
		  muted
          transparent
          style={{
            position: 'absolute',
            width: WIDTH,
            height: HEIGHT,
            objectFit: 'cover',
          }}
        />
      </Sequence>

      {/* ── AI Generated Drawing Video: frames 125–274 (new split path) ──────── */}
      {/* Standard full-screen MP4/MOV — drawing portion of the AI screen recording. */}
      {useNewAiSlots && frame >= AI_DRAWING_VIDEO_START && frame <= AI_DRAWING_VIDEO_END && ai_drawing_videoUri ? (
        <Sequence
          from={AI_DRAWING_VIDEO_START}
          durationInFrames={AI_DRAWING_VIDEO_DURATION}
        >
          <OffthreadVideo
            src={ai_drawing_videoUri}
            muted
            trimBefore={ai_drawing_sourceStartFrame}
            style={{
              width: WIDTH,
              height: HEIGHT,
              objectFit: 'cover',
              objectPosition: 'center center',
            }}
          />
        </Sequence>
      ) : null}

      {/* ── AI Generated Result Video: frames 275–374 (new split path) ──────── */}
      {/* Standard full-screen MP4/MOV — result portion of the AI screen recording. */}
      {useNewAiSlots && frame >= AI_RESULT_VIDEO_START && frame <= AI_RESULT_VIDEO_END && ai_result_videoUri ? (
        <Sequence
          from={AI_RESULT_VIDEO_START}
          durationInFrames={AI_RESULT_VIDEO_DURATION}
        >
          <OffthreadVideo
            src={ai_result_videoUri}
            muted
            trimBefore={ai_result_sourceStartFrame}
            style={{
              width: WIDTH,
              height: HEIGHT,
              objectFit: 'cover',
              objectPosition: 'center center',
            }}
          />
        </Sequence>
      ) : null}

      {/* ── AI Generated Video (legacy fallback): frames 125–374 ────────────── */}
      {/* Used only when neither ai_generated_drawing_video nor ai_generated_result_video is provided. */}
      {!useNewAiSlots && frame >= AI_GENERATED_VIDEO_START && frame <= AI_GENERATED_VIDEO_END && ai_generated_videoUri ? (
        <Sequence
          from={AI_GENERATED_VIDEO_START}
          durationInFrames={AI_GENERATED_VIDEO_DURATION}
        >
          <OffthreadVideo
            src={ai_generated_videoUri}
            muted
            trimBefore={ai_generated_videoSourceStartFrame}
            style={{
              position: 'absolute',
              width: WIDTH,
              height: HEIGHT,
              objectFit: 'cover',
            }}
          />
        </Sequence>
      ) : null}

      {/* ── Closing Video: REMOVED per client request ─────────────────────────── */}
      {/* ── Composition ends at frame 374 ────────────────────────────────────── */}
      {/* Video composition is 375 frames (15 seconds at 25fps). */}

      {/* ── Text2: supers animated element, frames 148–234 ─────────────────────── */}
      {frame >= TEXT2_START && frame <= TEXT2_END && hasText2Supers ? (
       <AnimatedSupersText
         frame={frame}
         lines={text2SupersLines}
         posStartY={TEXT2_POSITION_START_Y}
         posEndY={TEXT2_POSITION_END_Y}
         posX={TEXT2_POSITION_X}
         posStartFrame={TEXT2_POSITION_START}
         posEndFrame={TEXT2_POSITION_END}
         opacityFadeInFrame={TEXT2_OPACITY_FADE_IN}
         opacityVisibleFrame={TEXT2_OPACITY_VISIBLE}
         opacityVisibleEndFrame={TEXT2_OPACITY_VISIBLE_END}
         opacityFadeOutFrame={TEXT2_OPACITY_FADE_OUT}
         fontFamily={marketFontFamily}
         compactLeading={compactSupersLeading}
       />
      ) : frame >= TEXT2_START && frame <= TEXT2_END && (text2Word1 || text2Word2 || text2Word3) ? (
       <AnimatedText3Word
         frame={frame}
         word1={text2Word1}
         word2={text2Word2}
         word3={text2Word3}
         color1={text2Color1}
         color2={text2Color2}
         color3={text2Color3}
         posStartY={TEXT2_POSITION_START_Y}
         posEndY={TEXT2_POSITION_END_Y}
         posX={TEXT2_POSITION_X}
         posStartFrame={TEXT2_POSITION_START}
         posEndFrame={TEXT2_POSITION_END}
         opacityFadeInFrame={TEXT2_OPACITY_FADE_IN}
         opacityVisibleFrame={TEXT2_OPACITY_VISIBLE}
         opacityVisibleEndFrame={TEXT2_OPACITY_VISIBLE_END}
         opacityFadeOutFrame={TEXT2_OPACITY_FADE_OUT}
         fontFamily={marketFontFamily}
       />
      ) : null}

      {/* ── Text3: supers animated element, fades out before CTA starts ───────── */}
      {frame >= TEXT3_START && frame <= TEXT3_END && hasText3Supers ? (
       <AnimatedSupersText
         frame={frame}
         lines={text3SupersLines}
         posStartY={TEXT3_POSITION_START_Y}
         posEndY={TEXT3_POSITION_END_Y}
         posX={TEXT3_POSITION_X}
         posStartFrame={TEXT3_POSITION_START}
         posEndFrame={TEXT3_POSITION_END}
         opacityFadeInFrame={TEXT3_OPACITY_FADE_IN}
         opacityVisibleFrame={TEXT3_OPACITY_VISIBLE}
         opacityVisibleEndFrame={TEXT3_OPACITY_VISIBLE_END}
         opacityFadeOutFrame={TEXT3_OPACITY_FADE_OUT}
         fontFamily={marketFontFamily}
         compactLeading={compactSupersLeading}
       />
      ) : frame >= TEXT3_START && frame <= TEXT3_END && (text3Word1 || text3Word2) ? (
       <AnimatedTextElement
         frame={frame}
         word1={text3Word1}
         word2={text3Word2}
         color1={text3Color1}
         color2={text3Color2}
         posStartY={TEXT3_POSITION_START_Y}
         posEndY={TEXT3_POSITION_END_Y}
         posX={TEXT3_POSITION_X}
         posStartFrame={TEXT3_POSITION_START}
         posEndFrame={TEXT3_POSITION_END}
         opacityFadeInFrame={TEXT3_OPACITY_FADE_IN}
         opacityVisibleFrame={TEXT3_OPACITY_VISIBLE}
         opacityVisibleEndFrame={TEXT3_OPACITY_VISIBLE_END}
         opacityFadeOutFrame={TEXT3_OPACITY_FADE_OUT}
         fontFamily={marketFontFamily}
       />
      ) : null}

      {/* ── Text4: red pill element, frames 300–374 ─────────────────────────── */}
      {/* Rendered BEFORE the logo so it appears underneath (z-index layering). */}
      {text4Value ? (
       <div style={{ position: 'relative', zIndex: 1 }}>
         <RedPill
           frame={frame}
           text={text4Value}
           startX={TEXT4_POSITION_START_X}
           startY={TEXT4_POSITION_START_Y}
           moveDistance={TEXT4_MOVE_DISTANCE}
           moveEndFrame={TEXT4_MOVE_END}
           startFrame={TEXT4_START}
           endFrame={TEXT4_END}
           fontFamily={marketFontFamily}
           textOffsetY={redPillTextYOffset}
         />
       </div>
      ) : null}

      {/* ── YouTube Shorts Logo: fixed transparent overlay, retimed ──────────── */}
      {/* Fixed template asset rendered above active media. */}
      {frame >= YT_SHORTS_LOGO_START && frame <= COMPOSITION_END ? (
       <Sequence
         from={YT_SHORTS_LOGO_START}
         durationInFrames={YT_SHORTS_LOGO_DURATION}
       >
         <div style={{ position: 'relative', zIndex: 2 }}>
           <OffthreadVideo
             src={YT_SHORTS_LOGO_URI}
			 muted
             transparent
             style={{
               position: 'absolute',
               width: WIDTH,
               height: HEIGHT,
               objectFit: 'cover',
             }}
           />
         </div>
       </Sequence>
      ) : null}

      {/* ── Outlined badge with editable text, frames 0–40 ──────────────────── */}
      {badgeVisible ? (
        /*
          Position remains anchored on BADGE_X so longer handles expand to the right,
          while the badge scale animation itself uses a centered transform origin.
        */
        <div
          style={{
            position: 'absolute',
            left: BADGE_X,
            top: BADGE_Y,
            transform: 'translateY(-50%)',
          }}
        >
          <DynamicTextBadge
            text={badgeText}
            scale={badgeScale}
            fontFamily={marketFontFamily}
            textOffsetY={badgeTextYOffset}
          />
        </div>
      ) : null}
      {/* ── Fixed click effects audio: full composition timeline ───────────── */}
      <Audio src={CLICK_EFFECTS_AUDIO_URI} volume={CLICK_EFFECTS_VOLUME} />

      {/* ── Background audio (Jolly Cute.wav — not yet in repo) ─────────────── */}
      {audioUri ? <Audio src={audioUri} volume={BGM_VOLUME} /> : null}

    </AbsoluteFill>
  );
};

// Re-export FPS for use in Root.tsx.
export { FPS as AI_DREAM_CAT_V1_FPS };

// Suppress unused-variable lint warning for timeline doc constants.
void AI_GENERATED_VIDEO_END;
void AI_DRAWING_VIDEO_END;
void AI_RESULT_VIDEO_END;
void TEXT2_END;
void TEXT3_END;
