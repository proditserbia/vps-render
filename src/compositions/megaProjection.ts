export type Point = number[];
/** Corners are top-left, top-right, bottom-left, bottom-right. */
export function homography(width: number, height: number, p: Point[]) {
  const a: number[][] = [];
  [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ].forEach(([x, y], i) => {
    const [u, v] = p[i];
    a.push(
      [x, y, 1, 0, 0, 0, -u * x, -u * y, u],
      [0, 0, 0, x, y, 1, -v * x, -v * y, v],
    );
  });
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++)
      if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    if (Math.abs(a[c][c]) < 1e-12)
      return [1, 0, -100000, 0, 1, -100000, 0, 0, 1];
    const d = a[c][c];
    for (let j = c; j < 9; j++) a[c][j] /= d;
    for (let r = 0; r < 8; r++)
      if (r !== c) {
        const m = a[r][c];
        for (let j = c; j < 9; j++) a[r][j] -= m * a[c][j];
      }
  }
  return [...a.map((r) => r[8]), 1];
}
export function matrix(h: number[]) {
  return `matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,${h[8]})`;
}
export function mapped(h: number[], [x, y]: Point) {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

/** Clip in homogeneous space before dividing by w. A rotating plane may cross
 * the camera: connecting its four already-projected corners creates bow ties. */
export function visiblePolygon(h: number[], width: number, height: number) {
  let points = [[0,0],[width,0],[width,height],[0,height]].map(([x,y]) => [h[0]*x+h[1]*y+h[2],h[3]*x+h[4]*y+h[5],h[6]*x+h[7]*y+h[8]]);
  const clip = (input: number[][], distance: (p: number[]) => number) => {
    const output: number[][] = [];
    input.forEach((b,i) => {
      const a=input[(i+input.length-1)%input.length], da=distance(a), db=distance(b);
      if ((da>=0)!==(db>=0)) {const t=da/(da-db);output.push(a.map((v,j)=>v+(b[j]-v)*t));}
      if(db>=0)output.push(b);
    });
    return output;
  };
  points=clip(points,p=>p[2]-0.0001);
  points=points.map(([x,y,w])=>[x/w,y/w]);
  for(const distance of [(p:number[])=>p[0],(p:number[])=>8248-p[0],(p:number[])=>p[1],(p:number[])=>2864-p[1]])points=clip(points,distance);
  return points;
}
export function rowAt(rows: number[][], frame: number) {
  let lo = 0,
    hi = rows.length - 1;
  while (lo < hi) {
    const m = Math.floor((lo + hi + 1) / 2);
    if (rows[m][0] <= frame) lo = m;
    else hi = m - 1;
  }
  const a = rows[lo],
    b = rows[Math.min(lo + 1, rows.length - 1)];
  const t =
    a === b ? 0 : Math.max(0, Math.min(1, (frame - a[0]) / (b[0] - a[0])));
  return a.slice(1).map((v, i) => v + (b[i + 1] - v) * t);
}
