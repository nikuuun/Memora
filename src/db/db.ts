import * as SQLite from 'expo-sqlite';

/**
 * One small on-device database that mirrors the photo library: one short row
 * per photo/video (no image data), plus tags and the user's decisions.
 * Searches, counts and "select all" run here instead of re-reading the photo
 * library, so they stay fast with tens of thousands of items.
 */

export const STATUS = { todo: 0, reviewed: 1, marked: 2 } as const;
export type Status = (typeof STATUS)[keyof typeof STATUS];

export type Row = {
  id: string;
  uri: string;
  media_type: string;
  duration: number;
  status: Status;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

async function open() {
  const db = await SQLite.openDatabaseAsync('memora.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY NOT NULL,
      uri TEXT NOT NULL,
      media_type TEXT NOT NULL,
      created INTEGER NOT NULL,
      year INTEGER NOT NULL,
      duration REAL NOT NULL DEFAULT 0,
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0,
      status INTEGER NOT NULL DEFAULT 0,
      status_at INTEGER,
      seen INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS assets_status_created ON assets (status, created DESC);
    CREATE INDEX IF NOT EXISTS assets_status_year ON assets (status, year);
    CREATE TABLE IF NOT EXISTS asset_tags (
      tag TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      PRIMARY KEY (tag, asset_id)
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS asset_tags_asset ON asset_tags (asset_id);
    CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      count INTEGER NOT NULL,
      tags TEXT NOT NULL,
      user_album INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    -- Photos taken or developed with the Memora camera. Files live in the app's
    -- documents folder (names only, the folder path changes between installs).
    CREATE TABLE IF NOT EXISTS shots (
      id TEXT PRIMARY KEY NOT NULL,
      original TEXT NOT NULL,
      developed TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      settings TEXT NOT NULL,
      created INTEGER NOT NULL,
      edited INTEGER NOT NULL,
      asset_id TEXT,
      source TEXT NOT NULL DEFAULT 'camera'
    );
    CREATE INDEX IF NOT EXISTS shots_created ON shots (created DESC);
  `);
  return db;
}

export async function getMeta(key: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
}

/** SQLite caps bound parameters per statement, so big id lists go in chunks. */
export function chunk<T>(items: T[], size = 400): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const marks = (n: number) => Array.from({ length: n }, () => '?').join(', ');
