import { VideoEntry, Settings } from "./types";

const VIDEOS_KEY = "vt_videos";
const SETTINGS_KEY = "vt_settings";

const DEFAULT_SETTINGS: Settings = {
  rpm: 0.2,
};

export function getVideos(): VideoEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(VIDEOS_KEY);
  if (!raw) return [];
  try {
    const videos = JSON.parse(raw) as VideoEntry[];
    return videos.map((v) => {
      if (v.paid === undefined) v.paid = false;
      return v;
    });
  } catch {
    return [];
  }
}

export function saveVideos(videos: VideoEntry[]): void {
  localStorage.setItem(VIDEOS_KEY, JSON.stringify(videos));
}

export function addVideo(video: VideoEntry): VideoEntry[] {
  const videos = getVideos();
  videos.unshift(video);
  saveVideos(videos);
  return videos;
}

export function updateVideo(
  id: string,
  updates: Partial<VideoEntry>
): VideoEntry[] {
  const videos = getVideos();
  const idx = videos.findIndex((v) => v.id === id);
  if (idx !== -1) {
    videos[idx] = { ...videos[idx], ...updates };
  }
  saveVideos(videos);
  return videos;
}

export function deleteVideo(id: string): VideoEntry[] {
  const videos = getVideos().filter((v) => v.id !== id);
  saveVideos(videos);
  return videos;
}

export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function detectPlatform(url: string): "tiktok" | "facebook" | "instagram" | null {
  const lower = url.toLowerCase();
  if (lower.includes("tiktok.com")) return "tiktok";
  if (lower.includes("facebook.com") || lower.includes("fb.watch") || lower.includes("fb.com")) return "facebook";
  if (lower.includes("instagram.com")) return "instagram";
  return null;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function calculatePayout(views: number, rpm: number): number {
  return (views / 1000) * rpm;
}

export function getDaysUntil14(dateAdded: string): number {
  const added = new Date(dateAdded);
  const target = new Date(added);
  target.setDate(target.getDate() + 14);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function is14DaysPassed(dateAdded: string): boolean {
  return getDaysUntil14(dateAdded) <= 0;
}

export function exportData(): string {
  const videos = getVideos();
  const settings = getSettings();
  return JSON.stringify({ videos, settings }, null, 2);
}

export function importData(json: string): { videos: VideoEntry[]; settings: Settings } {
  const data = JSON.parse(json);
  if (data.videos) saveVideos(data.videos);
  if (data.settings) saveSettings(data.settings);
  return { videos: data.videos || [], settings: data.settings || DEFAULT_SETTINGS };
}
