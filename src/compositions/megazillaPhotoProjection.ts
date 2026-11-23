import { homography, rowAt } from './megaProjection';

// Camera calibration of the existing 8248 x 2864 Megazilla geometry.
const cameraX = 4124;
const cameraY = 1432;
const focalLength = 672.19923668;

const cache = new WeakMap<number[][], number[][]>();
/** Keep the camera-space sign continuous when the photo's origin or centre
 * crosses the camera. Screen-space centre tests discard still-visible corners. */
export function photoProjection(rect: number[], rows: number[][], frame: number) {
  let track = cache.get(rows);
  if (!track) {
    let previous: number[] | undefined;
    track = rows.map(row => {
      let h = homography(rect[2], rect[3], [row.slice(1,3),row.slice(3,5),row.slice(5,7),row.slice(7,9)]);
      const axes = (m: number[]) => [
        (m[0]-cameraX*m[6])/focalLength, (m[3]-cameraY*m[6])/focalLength, m[6],
        (m[1]-cameraX*m[7])/focalLength, (m[4]-cameraY*m[7])/focalLength, m[7],
      ];
      const norm = Math.hypot(...axes(h).slice(0,3));
      h = h.map(v=>v/norm);
      const axis = axes(h);
      const flip = previous ? axis.reduce((s,v,i)=>s+v*previous![i],0)<0
        : h[6]*rect[2]/2+h[7]*rect[3]/2+h[8]<0;
      if (flip) h = h.map(v=>-v);
      previous = axes(h);
      return [row[0],...h];
    });
    cache.set(rows,track);
  }
  const h = rowAt(track,frame);
  const scale = Math.max(Math.abs(h[6]*rect[2]),Math.abs(h[7]*rect[3]),Math.abs(h[8]));
  return h.map(v=>v/scale);
}
