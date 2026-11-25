import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import { getDb } from '../db/db';
import { useLibrary } from '../library/store';
import { saveToMemora } from '../media/save';
import { developToJpeg, loadSkImage, OUTPUT_LONG_SIDE } from './Developed';
import type { Develop } from './look';

/**
 * Memora photos: every shot keeps its untouched original and the developed
 * copy in the app's documents folder, plus a row in the database with the
 * camera settings, so it can be re-edited without losing quality. Each
 * develop also saves a copy to Photos (Memora album).
 */

export type Shot = {
  id: string;
  /** file:// URIs, resolved from the stored file names. */
  originalUri: string;
  developedUri: string;
  width: number;
  height: number;
  develop: Develop;
  created: number;
  edited: number;
  assetId: string | null;
  source: 'camera' | 'import';
};

type ShotRow = {
  id: string;
  original: string;
  developed: string;
  width: number;
  height: number;
  settings: string;
  created: number;
  edited: number;
  asset_id: string | null;
  source: string;
};

function dir() {
  const d = new Directory(Paths.document, 'shots');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

const fileIn = (name: string) => new File(dir(), name);

const toShot = (r: ShotRow): Shot => ({
  id: r.id,
  originalUri: fileIn(r.original).uri,
  developedUri: fileIn(r.developed).uri,
  width: r.width,
  height: r.height,
  develop: JSON.parse(r.settings) as Develop,
  created: r.created,
  edited: r.edited,
  assetId: r.asset_id,
  source: r.source === 'import' ? 'import' : 'camera',
});

/** Grain pattern stays the same for a photo across edits. */
export const seedFor = (created: number) => (created % 997) + 1;

async function writeDeveloped(id: string, originalUri: string, develop: Develop, created: number) {
  const image = await loadSkImage(originalUri);
  const bytes = await developToJpeg(image, develop, new Date(created), seedFor(created));
  // A new name each time, so cached thumbnails of the old version never show.
  const name = `${id}-${Date.now()}.jpg`;
  const file = fileIn(name);
  await file.write(bytes);
  return { name, uri: file.uri };
}

/**
 * Takes a camera capture or a library photo, keeps an upright copy of the
 * original, develops it, saves a copy to Photos and records it.
 */
export async function addShot(sourceUri: string, develop: Develop, source: 'camera' | 'import', takenAt = Date.now()) {
  const id = randomUUID();
  // Upright pixels (no EXIF rotation) at a sensible size; also reads ph:// on iOS.
  const ref = await ImageManipulator.ImageManipulator.manipulate(sourceUri, {
    maxWidth: OUTPUT_LONG_SIDE,
    maxHeight: OUTPUT_LONG_SIDE,
  }).renderAsync();
  const normalized = await ref.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.95 });
  const originalName = `${id}-original.jpg`;
  const original = fileIn(originalName);
  await new File(normalized.uri).move(original);

  const dev = await writeDeveloped(id, original.uri, develop, takenAt);
  const assetId = await saveToMemora(dev.uri);

  const db = await getDb();
  await db.runAsync(
    'INSERT INTO shots (id, original, developed, width, height, settings, created, edited, asset_id, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    originalName,
    dev.name,
    normalized.width,
    normalized.height,
    JSON.stringify(develop),
    takenAt,
    Date.now(),
    assetId,
    source,
  );
  useLibrary.getState().bump();
  return { id, developedUri: dev.uri };
}

/** Re-develops from the original with new settings and saves a fresh copy to Photos. */
export async function saveEdit(shot: Shot, develop: Develop) {
  const dev = await writeDeveloped(shot.id, shot.originalUri, develop, shot.created);
  const assetId = await saveToMemora(dev.uri);
  const db = await getDb();
  const old = await db.getFirstAsync<{ developed: string }>('SELECT developed FROM shots WHERE id = ?', shot.id);
  await db.runAsync(
    'UPDATE shots SET developed = ?, settings = ?, edited = ?, asset_id = ? WHERE id = ?',
    dev.name,
    JSON.stringify(develop),
    Date.now(),
    assetId,
    shot.id,
  );
  if (old && old.developed !== dev.name) {
    try {
      fileIn(old.developed).delete();
    } catch {}
  }
  useLibrary.getState().bump();
}

/** Takes a photo out of Memora. Copies already saved in Photos stay there. */
export async function removeShot(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<ShotRow>('SELECT * FROM shots WHERE id = ?', id);
  await db.runAsync('DELETE FROM shots WHERE id = ?', id);
  for (const name of row ? [row.original, row.developed] : []) {
    try {
      fileIn(name).delete();
    } catch {}
  }
  useLibrary.getState().bump();
}

export async function listShots(limit?: number) {
  const db = await getDb();
  const rows = limit
    ? await db.getAllAsync<ShotRow>('SELECT * FROM shots ORDER BY created DESC LIMIT ?', limit)
    : await db.getAllAsync<ShotRow>('SELECT * FROM shots ORDER BY created DESC');
  return rows.map(toShot);
}

export async function getShot(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<ShotRow>('SELECT * FROM shots WHERE id = ?', id);
  return row ? toShot(row) : null;
}
