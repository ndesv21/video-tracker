import { Pool } from "pg";
import { VideoEntry, Settings } from "./types";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

let initialized = false;

async function initTables(): Promise<void> {
  if (initialized) return;
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        platform TEXT NOT NULL,
        "creatorName" TEXT DEFAULT '',
        "postedDate" TEXT DEFAULT '',
        "dateAdded" TEXT NOT NULL,
        "viewsOnAdd" INTEGER,
        "viewsDay14" INTEGER,
        "lastCheckedDate" TEXT,
        "lastCheckedViews" INTEGER,
        "manualViews" BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'tracking',
        paid BOOLEAN DEFAULT false,
        notes TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const { rows } = await client.query("SELECT value FROM settings WHERE key = 'rpm'");
    if (rows.length === 0) {
      await client.query("INSERT INTO settings (key, value) VALUES ('rpm', '0.2')");
    }
    initialized = true;
  } finally {
    client.release();
  }
}

// --- Videos ---

export async function getAllVideos(): Promise<VideoEntry[]> {
  await initTables();
  const { rows } = await getPool().query('SELECT * FROM videos ORDER BY "dateAdded" DESC');
  return rows.map(rowToVideo);
}

export async function insertVideo(video: VideoEntry): Promise<void> {
  await initTables();
  await getPool().query(
    `INSERT INTO videos (id, url, platform, "creatorName", "postedDate", "dateAdded", "viewsOnAdd", "viewsDay14", "lastCheckedDate", "lastCheckedViews", "manualViews", status, paid, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (id) DO NOTHING`,
    [video.id, video.url, video.platform, video.creatorName, video.postedDate,
     video.dateAdded, video.viewsOnAdd, video.viewsDay14, video.lastCheckedDate,
     video.lastCheckedViews, video.manualViews, video.status, video.paid, video.notes]
  );
}

export async function updateVideoDb(id: string, updates: Partial<VideoEntry>): Promise<void> {
  await initTables();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, val] of Object.entries(updates)) {
    if (key === "id") continue;
    setClauses.push(`"${key}" = $${idx}`);
    values.push(val);
    idx++;
  }

  if (setClauses.length === 0) return;
  values.push(id);
  await getPool().query(`UPDATE videos SET ${setClauses.join(", ")} WHERE id = $${idx}`, values);
}

export async function deleteVideoDb(id: string): Promise<void> {
  await initTables();
  await getPool().query("DELETE FROM videos WHERE id = $1", [id]);
}

// --- Settings ---

export async function getSettingsDb(): Promise<Settings> {
  await initTables();
  const { rows } = await getPool().query("SELECT value FROM settings WHERE key = 'rpm'");
  return { rpm: rows.length > 0 ? parseFloat(rows[0].value) : 0.2 };
}

export async function saveSettingsDb(settings: Settings): Promise<void> {
  await initTables();
  await getPool().query(
    "INSERT INTO settings (key, value) VALUES ('rpm', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
    [String(settings.rpm)]
  );
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
    manualViews: !!(row.manualViews),
    status: (row.status as VideoEntry["status"]) || "tracking",
    paid: !!(row.paid),
    notes: (row.notes as string) || "",
  };
}
