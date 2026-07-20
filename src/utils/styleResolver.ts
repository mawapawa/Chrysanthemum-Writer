import type { StyleV2, ComputedStyle, AppearanceAsset, ProjectAsset, FitMode } from "../types";

const DEFAULTS: ComputedStyle = {
  opacity: 1, padding: "", margin: "", background: "", boxShadow: "",
  borderRadius: "", borderWidth: "", borderColor: "", borderStyle: "none",
};

function pick<T>(val: T | undefined, def: T): T {
  return val !== undefined && val !== "" ? val : def;
}

// ─── Appearance resolver ─────────────────────────────────────────

function fitModeCSS(mode?: FitMode): string {
  switch (mode) {
    case "stretch": return "100% 100%";
    case "fit":     return "contain";
    case "fill":    return "cover";
    case "tile":    return "auto";
    case "center":  return "auto";
    default:        return "100% 100%";
  }
}

function fitRepeat(mode?: FitMode): string {
  return mode === "tile" ? "repeat" : "no-repeat";
}

function resolveAppearance(
  appearance: AppearanceAsset | undefined,
  assets?: ProjectAsset[]
): string {
  if (!appearance || appearance.type === "default") return "";

  if (appearance.type === "color") {
    return appearance.backgroundColor ?? "";
  }

  if (appearance.type === "image" && appearance.assetId) {
    const asset = assets?.find(a => a.id === appearance.assetId);
    if (!asset) return appearance.backgroundColor ?? "";
    const bgs = `url(${asset.source})`;
    const size = fitModeCSS(appearance.fitMode);
    const repeat = fitRepeat(appearance.fitMode);
    return `${bgs} center / ${size} ${repeat}`;
  }

  return "";
}

// ─── Main resolver ───────────────────────────────────────────────

export function resolveStyle(style: StyleV2, assets?: ProjectAsset[]): ComputedStyle {
  const appBg = resolveAppearance(style.appearance, assets);
  const bg = appBg || pick(style.background ?? (style.bgColor ? style.bgColor : undefined), DEFAULTS.background);
  return {
    opacity: style.opacity ?? DEFAULTS.opacity,
    padding: pick(style.padding, DEFAULTS.padding),
    margin: pick(style.margin, DEFAULTS.margin),
    background: bg,
    boxShadow: pick(style.boxShadow, DEFAULTS.boxShadow),
    borderRadius: pick(style.borderRadius, DEFAULTS.borderRadius),
    borderWidth: pick(style.borderWidth, DEFAULTS.borderWidth),
    borderColor: pick(style.borderColor, DEFAULTS.borderColor),
    borderStyle: style.borderStyle ?? DEFAULTS.borderStyle,
  };
}
