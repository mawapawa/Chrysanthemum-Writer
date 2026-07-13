export function textColorForHex(hex: string): string {
  const val = parseInt(hex.replace("#", ""), 16);
  const r = (val >> 16) & 0xff, g = (val >> 8) & 0xff, b = val & 0xff;
  return (r * 0.299 + g * 0.587 + b * 0.114) > 200 ? "text-slate-950" : "text-white";
}
