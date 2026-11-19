import React from "react";
import calibration from "./godzilla-glass-calibration.json";
const canopy = "M732 319 C748 262 820 232 1009 231 Z";
const [blue, green, red] = calibration.bgr_coefficients;
// Separate static glass transmission from the live reflected image. Fit on
// alternating AE frames and validate on intervening frames; no baked pixels.
export const GodzillaGlass = () => (
  <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
    <defs>
      <clipPath id="godzilla-canopy-v4" clipPathUnits="userSpaceOnUse">
        <path d={canopy} />
      </clipPath>
      <clipPath id="godzilla-outside-canopy-v4" clipPathUnits="userSpaceOnUse">
        <path d={`M0 0 H1920 V1080 H0 Z ${canopy}`} clipRule="evenodd" />
      </clipPath>
      <filter
        id="godzilla-reflection-color-v4"
        x="-30%"
        y="-100%"
        width="160%"
        height="300%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur stdDeviation={calibration.blur / 0.338359000481477} />
        <feComponentTransfer>
          <feFuncR type="linear" slope={red[1]} intercept={red[2]} />
          <feFuncG type="linear" slope={green[1]} intercept={green[2]} />
          <feFuncB type="linear" slope={blue[1]} intercept={blue[2]} />
        </feComponentTransfer>
      </filter>
      <filter
        id="godzilla-glass-transmission-v4"
        colorInterpolationFilters="sRGB"
      >
        <feComponentTransfer>
          <feFuncR type="linear" slope={red[0]} />
          <feFuncG type="linear" slope={green[0]} />
          <feFuncB type="linear" slope={blue[0]} />
          <feFuncA type="linear" slope={calibration.foreground_alpha} />
        </feComponentTransfer>
      </filter>
    </defs>
  </svg>
);
