/**
 * Slot prop types for Remotion compositions.
 * Mirrors src/lib/slotProps.ts in the frontend — kept separate so the
 * remotion-templates package has no dependency on the main app.
 * slot_id === Remotion prop name — hard contract per the Template Stamper spec.
 */

export interface ImageSlotProp {
  type: 'image';
  uri: string;
  fit_mode?: 'cover' | 'contain' | null;
  crop_anchor?: string | null;
}

export interface VideoSlotProp {
  type: 'video';
  uri: string;
  fit_mode?: 'cover' | 'contain' | null;
  crop_anchor?: string | null;
  /** Trim start offset in seconds, set by the operator in the Generate UI. */
  trim_start_seconds?: number;
  /** Number of frames the slot occupies in the composition (used for validation). */
  trim_duration_frames?: number;
  /** FPS of the composition this slot belongs to (used to compute trimBefore). */
  trim_fps?: number;
}

export interface TextSlotProp {
  type: 'text';
  value: string;
  language?: string;
}

export interface AudioSlotProp {
  type: 'audio';
  uri: string;
}

/** A slot prop is one of the typed shapes, or null for unfilled optional slots. */
export type SlotProp = ImageSlotProp | VideoSlotProp | TextSlotProp | AudioSlotProp | null;

/** Maps a crop_anchor string to a CSS objectPosition value. */
export function cropAnchorToObjectPosition(anchor?: string | null): string {
  switch (anchor) {
    case 'top': return 'center top';
    case 'bottom': return 'center bottom';
    case 'left': return 'left center';
    case 'right': return 'right center';
    case 'top-left': return 'left top';
    case 'top-right': return 'right top';
    case 'bottom-left': return 'left bottom';
    case 'bottom-right': return 'right bottom';
    case 'center':
    default: return 'center center';
  }
}
