import { VideoEntry, Settings } from "./types";

export async function apiGetVideos(): Promise<VideoEntry[]> {
  const res = await fetch("/api/videos");
  if (!res.ok) throw new Error("Failed to fetch videos");
  return res.json();
}

export async function apiAddVideo(video: VideoEntry): Promise<void> {
  const res = await fetch("/api/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(video),
  });
  if (!res.ok) throw new Error("Failed to add video");
}

export async function apiUpdateVideo(id: string, updates: Partial<VideoEntry>): Promise<void> {
  const res = await fetch(`/api/videos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update video");
}

export async function apiDeleteVideo(id: string): Promise<void> {
  const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete video");
}

export async function apiGetSettings(): Promise<Settings> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export async function apiSaveSettings(settings: Settings): Promise<void> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Failed to save settings");
}
