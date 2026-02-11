import { Platform } from "./types";

export function formatNumber(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export function formatCurrency(n: number): string {
  return "$" + n.toFixed(2);
}

export function platformColor(p: Platform): string {
  switch (p) {
    case "tiktok":
      return "bg-gray-900 text-white";
    case "facebook":
      return "bg-blue-600 text-white";
    case "instagram":
      return "bg-gradient-to-r from-purple-500 to-pink-500 text-white";
  }
}

export function platformLabel(p: Platform): string {
  switch (p) {
    case "tiktok":
      return "TikTok";
    case "facebook":
      return "Facebook";
    case "instagram":
      return "Instagram";
  }
}
