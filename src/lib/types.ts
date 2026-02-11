export type Platform = "tiktok" | "facebook" | "instagram";

export interface VideoEntry {
  id: string;
  url: string;
  platform: Platform;
  creatorName: string;
  postedDate: string; // ISO date string
  dateAdded: string; // ISO date string
  viewsOnAdd: number | null;
  viewsDay14: number | null;
  lastCheckedDate: string | null;
  lastCheckedViews: number | null;
  manualViews: boolean;
  status: "tracking" | "completed" | "error";
  paid: boolean;
  notes: string;
}

export interface Settings {
  rpm: number; // revenue per mille (per 1000 views), default 0.2
}

export interface ViewScrapeResult {
  success: boolean;
  views: number | null;
  error?: string;
  platform: Platform;
}
