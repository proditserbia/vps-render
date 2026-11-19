import React from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { loadDoohFonts } from "./doohAssets";

type Fit = {
  text: string;
  prefix: "LA" | "Mega";
  family: string;
  baseSize: number;
  maxWidth: number;
  maxHeight: number;
};
function useFittedSize({
  text,
  prefix,
  family,
  baseSize,
  maxWidth,
  maxHeight,
}: Fit) {
  const [size, setSize] = React.useState(baseSize);
  const [initial] = React.useState(() => delayRender("Fit template text"));
  React.useEffect(() => {
    let active = true;
    const handle = delayRender("Measure template text");
    loadDoohFonts(prefix)
      .then(() => {
        if (!active) return;
        const context = document.createElement("canvas").getContext("2d");
        if (!context) throw new Error("Text measurement unavailable");
        context.font = `${baseSize}px ${family}`;
        const lines = text.split("\n");
        const width = Math.max(
          1,
          ...lines.map((line) => context.measureText(line).width),
        );
        setSize(
          Math.min(
            baseSize,
            (baseSize * maxWidth) / width,
            maxHeight / lines.length,
          ),
        );
        continueRender(handle);
        continueRender(initial);
      })
      .catch((error) => {
        if (active) cancelRender(error);
      });
    return () => {
      active = false;
      continueRender(handle);
      continueRender(initial);
    };
  }, [text, prefix, family, baseSize, maxWidth, maxHeight, initial]);
  return size;
}

export function FittedDoohText(props: Fit & { style: React.CSSProperties }) {
  const size = useFittedSize(props);
  return (
    <div
      style={{
        ...props.style,
        fontFamily: props.family,
        fontSize: size,
        whiteSpace: "pre",
        lineHeight: 1,
      }}
    >
      {props.text}
    </div>
  );
}

export function FittedDoohSvgText(
  props: Fit & {
    x: number;
    y: number;
    fill: string;
    textAnchor?: "middle" | "start";
  },
) {
  const size = useFittedSize(props);
  const lines = props.text.split("\n");
  return (
    <text
      x={props.x}
      y={props.y}
      fontFamily={props.family}
      fontSize={size}
      fill={props.fill}
      textAnchor={props.textAnchor ?? "start"}
      xmlSpace="preserve"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={props.x} y={props.y - (lines.length - 1 - i) * size}>
          {line}
        </tspan>
      ))}
    </text>
  );
}
