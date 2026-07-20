import type { StyleV2, ComputedStyle } from "../types";

const DEFAULTS: ComputedStyle = {
  opacity: 1,
  padding: "",
  margin: "",
  background: "",
  boxShadow: "",
  borderRadius: "",
  borderWidth: "",
  borderColor: "",
  borderStyle: "none",
};

function pick<T>(val: T | undefined, def: T): T {
  return val !== undefined && val !== "" ? val : def;
}

export function resolveStyle(style: StyleV2): ComputedStyle {
  return {
    opacity: style.opacity ?? DEFAULTS.opacity,
    padding: pick(style.padding, DEFAULTS.padding),
    margin: pick(style.margin, DEFAULTS.margin),
    // background: prefer explicit background, fall back to bgColor shorthand
    background: pick(style.background ?? (style.bgColor ? style.bgColor : undefined), DEFAULTS.background),
    boxShadow: pick(style.boxShadow, DEFAULTS.boxShadow),
    borderRadius: pick(style.borderRadius, DEFAULTS.borderRadius),
    borderWidth: pick(style.borderWidth, DEFAULTS.borderWidth),
    borderColor: pick(style.borderColor, DEFAULTS.borderColor),
    borderStyle: style.borderStyle ?? DEFAULTS.borderStyle,
  };
}
