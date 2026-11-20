import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const PALETTE = {
  violet: { dot: "bg-violet-500", soft: "bg-violet-500/15 text-violet-700 dark:text-violet-300", ring: "ring-violet-500/40" },
  fuchsia: { dot: "bg-fuchsia-500", soft: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300", ring: "ring-fuchsia-500/40" },
  rose: { dot: "bg-rose-500", soft: "bg-rose-500/15 text-rose-700 dark:text-rose-300", ring: "ring-rose-500/40" },
  orange: { dot: "bg-orange-500", soft: "bg-orange-500/15 text-orange-700 dark:text-orange-300", ring: "ring-orange-500/40" },
  amber: { dot: "bg-amber-400", soft: "bg-amber-400/20 text-amber-800 dark:text-amber-300", ring: "ring-amber-400/40" },
  lime: { dot: "bg-lime-500", soft: "bg-lime-500/15 text-lime-800 dark:text-lime-300", ring: "ring-lime-500/40" },
  emerald: { dot: "bg-emerald-500", soft: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500/40" },
  cyan: { dot: "bg-cyan-500", soft: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300", ring: "ring-cyan-500/40" },
  blue: { dot: "bg-blue-500", soft: "bg-blue-500/15 text-blue-700 dark:text-blue-300", ring: "ring-blue-500/40" },
} as const;

export type PaletteColor = keyof typeof PALETTE;
export const PALETTE_COLORS = Object.keys(PALETTE) as PaletteColor[];

export function paletteOf(color: string | null | undefined) {
  return PALETTE[(color as PaletteColor) in PALETTE ? (color as PaletteColor) : "violet"];
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.round(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function randomToken(bytes = 18) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function toBase64(bytes: Uint8Array) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

export function fromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const CURSOR_COLORS = ["#8b5cf6", "#d946ef", "#f43f5e", "#f97316", "#10b981", "#06b6d4", "#3b82f6"];
export function colorForId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CURSOR_COLORS[h % CURSOR_COLORS.length];
}
