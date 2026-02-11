import Database from "better-sqlite3";
import path from "path";
import { VideoEntry, Settings } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "tracker.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initTables(db);
  }
  return db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      platform TEXT NOT NULL,
      creatorName TEXT DEFAULT '',
      postedDate TEXT DEFAULT '',
      dateAdded TEXT NOT NULL,
      viewsOnAdd INTEGER,
      viewsDay14 INTEGER,
      lastCheckedDate TEXT,
      lastCheckedViews INTEGER,
      manualViews INTEGER DEFAULT 0,
      status TEXT DEFAULT 'tracking',
      paid INTEGER DEFAULT 0,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Insert default RPM if not exists
  const existing = db.prepare("SELECT value FROM settings WHERE key = 'rpm'").get();
  if (!existing) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('rpm', '0.2')").run();
  }
}

// --- Videos ---

export function getAllVideos(): VideoEntry[] {
  const rows = getDb().prepare("SELECT * FROM videos ORDER BY dateAdded DESC").all() as Record<string, unknown>[];
  return rows.map(rowToVideo);
}

export function insertVideo(video: VideoEntry): void {
  getDb().prepare(`
    INSERT INTO videos (id, url, platform, creatorName, postedDate, dateAdded, viewsOnAdd, viewsDay14, lastCheckedDate, lastCheckedViews, manualViews, status, paid, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    video.id, video.url, video.platform, video.creatorName, video.postedDate,
    video.dateAdded, video.viewsOnAdd, video.viewsDay14, video.lastCheckedDate,
    video.lastCheckedViews, video.manualViews ? 1 : 0, video.status, video.paid ? 1 : 0, video.notes
  );
}

export function updateVideoDb(id: string, updates: Partial<VideoEntry>): void {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, val] of Object.entries(updates)) {
    if (key === "id") continue;
    let dbVal: unknown = val;
    if (key === "manualViews" || key === "paid") dbVal = val ? 1 : 0;
    setClauses.push(`${key} = ?`);
    values.push(dbVal);
  }

  if (setClauses.length === 0) return;
  values.push(id);
  getDb().prepare(`UPDATE videos SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteVideoDb(id: string): void {
  getDb().prepare("DELETE FROM videos WHERE id = ?").run(id);
}

// --- Settings ---

export function getSettingsDb(): Settings {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'rpm'").get() as { value: string } | undefined;
  return { rpm: row ? parseFloat(row.value) : 0.2 };
}

export function saveSettingsDb(settings: Settings): void {
  getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('rpm', ?)").run(String(settings.rpm));
}

// --- Helpers ---

function rowToVideo(row: Record<string, unknown>): VideoEntry {
  return {
    id: row.id as string,
    url: row.url as string,
    platform: row.platform as VideoEntry["platform"],
    creatorName: (row.creatorName as string) || "",
    postedDate: (row.postedDate as string) || "",
    dateAdded: row.dateAdded as string,
    viewsOnAdd: row.viewsOnAdd as number | null,
    viewsDay14: row.viewsDay14 as number | null,
    lastCheckedDate: row.lastCheckedDate as string | null,
    lastCheckedViews: row.lastCheckedViews as number | null,
    manualViews: !!(row.manualViews as number),
    status: (row.status as VideoEntry["status"]) || "tracking",
    paid: !!(row.paid as number),
    notes: (row.notes as string) || "",
  };
}
