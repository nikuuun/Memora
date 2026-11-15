import type { Asset } from 'expo-media-library/legacy';

import { useLibrary } from '../library/store';
import { chunk, getDb, marks, STATUS, type Status } from './db';

/**
 * Every decision is a status change in the database. Nothing here deletes a
 * photo from the phone; that only happens on the Review screen.
 */

export type Change = { id: string; prev: Status; next: Status };

async function setStatus(ids: string[], status: Status) {
  if (!ids.length) return;
  const db = await getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const part of chunk(ids)) {
      await db.runAsync(`UPDATE assets SET status = ?, status_at = ? WHERE id IN (${marks(part.length)})`, [status, now, ...part]);
    }
  });
}

function byStatus(changes: Change[], key: 'prev' | 'next') {
  const groups = new Map<Status, string[]>();
  for (const c of changes) {
    if (c.prev === c.next) continue;
    const list = groups.get(c[key]) ?? [];
    list.push(c.id);
    groups.set(c[key], list);
  }
  return groups;
}

/** Applies changes and returns a function that puts everything back. */
export async function applyChanges(changes: Change[]) {
  for (const [status, ids] of byStatus(changes, 'next')) await setStatus(ids, status);
  useLibrary.getState().bump();
  return async () => {
    for (const [status, ids] of byStatus(changes, 'prev')) await setStatus(ids, status);
    useLibrary.getState().bump();
  };
}

export async function setOne(id: string, prev: Status, next: Status) {
  await applyChanges([{ id, prev, next }]);
}

export async function unmarkAll() {
  const db = await getDb();
  await db.runAsync('UPDATE assets SET status = ?, status_at = ? WHERE status = ?', STATUS.todo, Date.now(), STATUS.marked);
  useLibrary.getState().bump();
}

/** From the Library grid: these assets may not be indexed yet, so upsert first. */
export async function markAssets(assets: Asset[]) {
  if (!assets.length) return;
  const db = await getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const a of assets) {
      const time = a.creationTime || a.modificationTime || 0;
      await db.runAsync(
        `INSERT INTO assets (id, uri, media_type, created, year, duration, width, height, status, status_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET status = excluded.status, status_at = excluded.status_at`,
        a.id, a.uri, a.mediaType, time, new Date(time).getFullYear(), a.duration || 0, a.width || 0, a.height || 0, STATUS.marked, now,
      );
    }
  });
  useLibrary.getState().bump();
}

/** After a real delete (or when photos turn out to be gone already). */
export async function forget(ids: string[]) {
  if (!ids.length) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const part of chunk(ids)) {
      await db.runAsync(`DELETE FROM assets WHERE id IN (${marks(part.length)})`, part);
      await db.runAsync(`DELETE FROM asset_tags WHERE asset_id IN (${marks(part.length)})`, part);
    }
  });
  useLibrary.getState().bumpLibrary();
}
