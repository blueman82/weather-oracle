/**
 * LAB Color Space Utilities
 *
 * Provides conversion between RGB and CIE LAB color spaces for
 * perceptually-uniform color gradients. LAB interpolation avoids
 * the "muddy greens" problem common with RGB interpolation.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface LAB {
  l: number;
  a: number;
  b: number;
}

interface XYZ {
  x: number;
  y: number;
  z: number;
}

// D65 illuminant reference white (CIE 15:2004 standard for sRGB)
const D65 = { X: 95.047, Y: 100.0, Z: 108.883 };

// LAB conversion constants
const EPSILON = 0.008856; // (6/29)^3
const KAPPA = 903.3; // (29/3)^3
const DELTA = 6 / 29;

/**
 * Expands gamma-compressed sRGB value to linear RGB.
 * sRGB uses a piecewise function with linear segment near black.
 */
function gammaExpand(c: number): number {
  const normalized = c / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Compresses linear RGB value back to gamma-corrected sRGB.
 */
function gammaCompress(c: number): number {
  let result: number;
  if (c <= 0.0031308) {
    result = 12.92 * c;
  } else {
    result = 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }
  return Math.round(clamp(result * 255, 0, 255));
}

/**
 * Clamps a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Converts RGB to XYZ color space using sRGB matrix.
 */
function rgbToXyz(rgb: RGB): XYZ {
  const r = gammaExpand(rgb.r);
  const g = gammaExpand(rgb.g);
  const b = gammaExpand(rgb.b);

  // sRGB to XYZ transformation matrix (D65 reference)
  return {
    x: (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100,
    y: (r * 0.2126729 + g * 0.7151522 + b * 0.072175) * 100,
    z: (r * 0.0193339 + g * 0.119192 + b * 0.9503041) * 100,
  };
}

/**
 * Converts XYZ to RGB color space.
 */
function xyzToRgb(xyz: XYZ): RGB {
  const x = xyz.x / 100;
  const y = xyz.y / 100;
  const z = xyz.z / 100;

  // XYZ to sRGB transformation matrix (D65 reference)
  const r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const g = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  const b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  return {
    r: gammaCompress(r),
    g: gammaCompress(g),
    b: gammaCompress(b),
  };
}

/**
 * Helper function for XYZ to LAB conversion.
 */
function labF(t: number): number {
  if (t > EPSILON) {
    return Math.cbrt(t);
  }
  return (KAPPA * t + 16) / 116;
}

/**
 * Inverse of labF for LAB to XYZ conversion.
 */
function labFInverse(t: number): number {
  if (t > DELTA) {
    return t * t * t;
  }
  return (116 * t - 16) / KAPPA;
}

/**
 * Converts XYZ to LAB color space.
 */
function xyzToLab(xyz: XYZ): LAB {
  const fx = labF(xyz.x / D65.X);
  const fy = labF(xyz.y / D65.Y);
  const fz = labF(xyz.z / D65.Z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * Converts LAB to XYZ color space.
 */
function labToXyz(lab: LAB): XYZ {
  const fy = (lab.l + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;

  return {
    x: D65.X * labFInverse(fx),
    y: D65.Y * labFInverse(fy),
    z: D65.Z * labFInverse(fz),
  };
}

/**
 * Converts an RGB color to LAB color space.
 *
 * @param rgb - RGB color with values in range [0, 255]
 * @returns LAB color with L in [0, 100], a and b typically in [-128, 127]
 */
export function rgbToLab(rgb: RGB): LAB {
  const xyz = rgbToXyz(rgb);
  return xyzToLab(xyz);
}

/**
 * Converts a LAB color to RGB color space.
 * RGB values are clamped to [0, 255] as some LAB colors
 * fall outside the sRGB gamut.
 *
 * @param lab - LAB color
 * @returns RGB color with values clamped to [0, 255]
 */
export function labToRgb(lab: LAB): RGB {
  const xyz = labToXyz(lab);
  return xyzToRgb(xyz);
}

/**
 * Linearly interpolates between two LAB colors.
 * This produces perceptually uniform gradients.
 *
 * @param lab1 - Starting LAB color
 * @param lab2 - Ending LAB color
 * @param t - Interpolation factor in [0, 1]
 * @returns Interpolated LAB color
 */
export function interpolateLab(lab1: LAB, lab2: LAB, t: number): LAB {
  return {
    l: lab1.l + (lab2.l - lab1.l) * t,
    a: lab1.a + (lab2.a - lab1.a) * t,
    b: lab1.b + (lab2.b - lab1.b) * t,
  };
}
