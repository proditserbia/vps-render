import { homography } from "./megaProjection";

/** Interpolate homogeneous transforms, never divided screen coordinates:
 * a corner crossing the camera has a pole in screen space. */
export function empPlaneAt(
  plane: { width: number; height: number; rows: number[][] },
  frame: number,
  scene: { width: number; height: number },
) {
  const rows = plane.rows;
  let lo = 0,
    hi = rows.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (rows[mid][0] <= frame) lo = mid;
    else hi = mid - 1;
  }
  const a = rows[lo],
    b = rows[Math.min(lo + 1, rows.length - 1)];
  const t =
    a === b ? 0 : Math.max(0, Math.min(1, (frame - a[0]) / (b[0] - a[0])));
  // AE camera zoom recovered from orthogonal plane axes in all four exports.
  const zoom = 672.19923668;
  const axes = (h: number[]) => [
    (h[0] - (scene.width / 2) * h[6]) / zoom,
    (h[3] - (scene.height / 2) * h[6]) / zoom,
    h[6],
    (h[1] - (scene.width / 2) * h[7]) / zoom,
    (h[4] - (scene.height / 2) * h[7]) / zoom,
    h[7],
  ];
  const project = (row: number[]) => {
    const h = homography(plane.width, plane.height, [
      row.slice(1, 3),
      row.slice(3, 5),
      row.slice(5, 7),
      row.slice(7, 9),
    ]);
    // Normalize by a camera-space unit axis, not translation magnitude.
    // Otherwise moving across the screen changes interpolation speed.
    const norm = Math.hypot(...axes(h).slice(0, 3));
    return h.map((v) => v / norm);
  };
  const ha = project(a),
    hb = project(b);
  // H and -H represent the same projection. Keep adjacent samples on the
  // same branch before interpolation, including when the origin crosses w=0.
  const axisA = axes(ha),
    axisB = axes(hb);
  const sign = axisA.reduce((sum, v, i) => sum + v * axisB[i], 0) < 0 ? -1 : 1;
  let h = ha.map((v, i) => v + (sign * hb[i] - v) * t);
  const centerW = (h[6] * plane.width) / 2 + (h[7] * plane.height) / 2 + h[8];
  const scale = Math.max(
    Math.abs(h[6] * plane.width),
    Math.abs(h[7] * plane.height),
    Math.abs(h[8]),
  );
  h = h.map((v) => (v / scale) * (centerW < 0 ? -1 : 1));
  return { h, opacity: a[9] + (b[9] - a[9]) * t };
}
