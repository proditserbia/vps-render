import React from "react";
import { Img } from "remotion";
import data from "../data/emp-motion.json";
import { homography, matrix, rowAt } from "./megaProjection";
import { doohStaticAsset } from "../doohAssets";

type Profile = Exclude<keyof typeof data, "logo">;
type Part = "artist" | "title" | "pill";
const multiply = (a: number[], b: number[]) =>
  Array.from({ length: 9 }, (_, i) =>
    [0, 1, 2].reduce(
      (s, k) => s + a[Math.floor(i / 3) * 3 + k] * b[k * 3 + (i % 3)],
      0,
    ),
  );
function inverse(a: number[]) {
  const b = [
    a[4] * a[8] - a[5] * a[7],
    a[2] * a[7] - a[1] * a[8],
    a[1] * a[5] - a[2] * a[4],
    a[5] * a[6] - a[3] * a[8],
    a[0] * a[8] - a[2] * a[6],
    a[2] * a[3] - a[0] * a[5],
    a[3] * a[7] - a[4] * a[6],
    a[1] * a[6] - a[0] * a[7],
    a[0] * a[4] - a[1] * a[3],
  ];
  const d = a[0] * b[0] + a[1] * b[3] + a[2] * b[6];
  return b.map((v) => v / d);
}
const corners = (r: number[]) => [
  r.slice(0, 2),
  r.slice(2, 4),
  r.slice(4, 6),
  r.slice(6, 8),
];
const translate = (x: number, y: number) => [1, 0, x, 0, 1, y, 0, 0, 1];

/** Relative AE motion keeps the responsive text layout independent of the sample artist's bounds. */
export function empCopyMotion(
  profile: Profile,
  part: Part,
  time: number,
): React.CSSProperties {
  if (time < 0) return { opacity: 0 };
  const rows = data[profile][part].rows;
  const row = rowAt(rows, time * 30),
    settled = rows[rows.length - 1].slice(1);
  const current = homography(100, 100, corners(row)),
    rest = homography(100, 100, corners(settled));
  const delta = multiply(
    multiply(
      translate(-settled[0], -settled[1]),
      multiply(current, inverse(rest)),
    ),
    translate(settled[0], settled[1]),
  );
  const area =
    (row[2] - row[0]) * (row[5] - row[1]) -
    (row[3] - row[1]) * (row[4] - row[0]);
  return {
    opacity: area > 0 && (part !== "artist" || time >= 0.31) ? row[8] : 0,
    transform: matrix(delta),
    transformOrigin: "0 0",
  };
}

/** Logo-only reference tracking, expressed in the original 1920x1080 brand plane. */
export const EmpBrand: React.FC<{ time: number }> = ({ time }) => {
  const asset = doohStaticAsset("assets/la-sunset/logo-black.png");
  const triangle = rowAt(data.logo.triangle, (time * 30000) / 1001);
  return (
    <>
      <Img
        src={asset}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
      />
      {(["word", "icon"] as const).map((part) => {
        const row = rowAt(data.logo[part], (time * 30000) / 1001);
        if (!row[8]) return null;
        const box =
          part === "icon" ? [196, 136, 394, 276] : [629, 144, 809, 255];
        const h = homography(box[2], box[3], corners(row));
        return (
          <svg
            key={part}
            width={box[2]}
            height={box[3]}
            viewBox={box.join(" ")}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transformOrigin: "0 0",
              transform: matrix(h),
              opacity: row[8],
              overflow: "hidden",
            }}
          >
            <image href={asset} width={1636} height={550} />
            {part === "icon" && (
              <rect x={349} y={211} width={112} height={128} fill="#ff0033" />
            )}
          </svg>
        );
      })}
      {triangle[6] > 0 && (
        <svg
          width={1920}
          height={1080}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            opacity: triangle[6],
          }}
        >
          <polygon
            points={`${triangle[0]},${triangle[1]} ${triangle[2]},${triangle[3]} ${triangle[4]},${triangle[5]}`}
            fill="white"
          />
        </svg>
      )}
    </>
  );
};
