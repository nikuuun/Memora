import * as MediaLibrary from 'expo-media-library/legacy';
import { AppState, Platform } from 'react-native';

import { useLibrary } from '../library/store';
import { chunk, getDb, getMeta, marks, setMeta } from './db';

/**
 * Keeps the database in step with the photo library.
 *
 * - First launch: reads the whole library once, 1,000 items per page.
 * - Later launches: a one-item check (count + newest photo). If nothing
 *   changed, nothing is read. If something did, it re-reads metadata only,
 *   which is a few seconds even for big libraries; decisions are kept.
 * - While the app is open, photo library change events trigger the same check.
 */

const MEDIA = [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video];
const NEWEST_FIRST: MediaLibrary.SortByValue[] = [[MediaLibrary.SortBy.creationTime, false]];
const PAGE = 1000;
const ROWS_PER_INSERT = 80; // 9 columns each: well under SQLite's parameter limit

let running: Promise<void> | null = null;
let rerun: 'no' | 'check' | 'full' = 'no';
let started = false;

export function syncLibrary(full = false): Promise<void> {
  if (running) {
    rerun = full || rerun === 'full' ? 'full' : 'check';
    return running;
  }
  running = (async () => {
    try {
      await doSync(full);
    } catch (e) {
      console.warn('Library sync failed', e);
    } finally {
      useLibrary.getState().setSync({ running: false, firstRun: false });
      running = null;
    }
    if (rerun !== 'no') {
      const again = rerun === 'full';
      rerun = 'no';
      await syncLibrary(again);
    }
  })();
  return running;
}

/** Call once photo access is granted. Safe to call many times. */
export function startLibrarySync() {
  void syncLibrary();
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  MediaLibrary.addListener((event) => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncLibrary(!event.hasIncrementalChanges), 800);
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void syncLibrary();
  });
}

async function doSync(full: boolean) {
  const db = await getDb();
  const store = useLibrary.getState();

  const head = await MediaLibrary.getAssetsAsync({ first: 1, mediaType: MEDIA, sortBy: NEWEST_FIRST });
  const fingerprint = `${head.totalCount}|${head.assets[0]?.id ?? ''}`;
  const previous = await getMeta('fingerprint');
  if (!full && previous === fingerprint) return;

  const firstRun = previous == null;
  store.setSync({ running: true, firstRun, done: 0, total: head.totalCount });

  const gen = Date.now();
  let after: string | undefined;
  let done = 0;
  for (;;) {
    const page = await MediaLibrary.getAssetsAsync({ first: PAGE, after, mediaType: MEDIA, sortBy: NEWEST_FIRST });
    await db.withTransactionAsync(async () => {
      for (const part of chunk(page.assets, ROWS_PER_INSERT)) {
        const params: (string | number)[] = [];
        for (const a of part) {
          const time = a.creationTime || a.modificationTime || 0;
          params.push(a.id, a.uri, a.mediaType, time, new Date(time).getFullYear(), a.duration || 0, a.width || 0, a.height || 0, gen);
        }
        await db.runAsync(
          `INSERT INTO assets (id, uri, media_type, created, year, duration, width, height, seen)
           VALUES ${part.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
           ON CONFLICT (id) DO UPDATE SET uri = excluded.uri, media_type = excluded.media_type,
             created = excluded.created, year = excluded.year, duration = excluded.duration,
             width = excluded.width, height = excluded.height, seen = excluded.seen`,
          params,
        );
      }
      // iOS tells us screenshots and Live Photos directly, in any phone language.
      const subtypeTags: [string, string][] = [];
      for (const a of page.assets) {
        for (const st of a.mediaSubtypes ?? []) {
          if (st === 'screenshot') subtypeTags.push(['sub:screenshot', a.id]);
          else if (st === 'livePhoto') subtypeTags.push(['sub:live', a.id]);
        }
      }
      await insertTags(subtypeTags);
    });

    done += page.assets.length;
    store.setSync({ done });
    if (firstRun) store.bump(); // let the first screens fill in as pages arrive
    if (!page.hasNextPage || !page.endCursor) break;
    after = page.endCursor;
  }

  // Anything not seen this pass was deleted outside Memora.
  await db.runAsync('DELETE FROM assets WHERE seen != ?', gen);
  await db.runAsync('DELETE FROM asset_tags WHERE asset_id NOT IN (SELECT id FROM assets)');

  await syncAlbums(full);
  await setMeta('fingerprint', fingerprint);
  store.bump();
}

async function insertTags(pairs: [string, string][]) {
  if (!pairs.length) return;
  const db = await getDb();
  for (const part of chunk(pairs, 400)) {
    await db.runAsync(
      `INSERT OR IGNORE INTO asset_tags (tag, asset_id) VALUES ${part.map(() => '(?, ?)').join(', ')}`,
      part.flat(),
    );
  }
}

type WantedAlbum = { album: MediaLibrary.Album; tags: string[]; userAlbum: boolean };

/**
 * Albums become keywords: your own albums (WhatsApp, Instagram, trips),
 * plus the Selfies and Bursts smart albums on iOS. On Android, albums are
 * folders, and the Screenshots folder doubles as the screenshot type.
 * Only albums whose size changed are re-read.
 */
async function syncAlbums(full: boolean) {
  const db = await getDb();
  const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });

  const wanted: WantedAlbum[] = [];
  for (const album of albums) {
    const title = album.title.trim().toLowerCase();
    if (Platform.OS === 'ios') {
      if (album.type === 'smartAlbum') {
        // Smart album names follow the phone's language; these match English.
        if (title === 'selfies') wanted.push({ album, tags: ['smart:selfies'], userAlbum: false });
        else if (title === 'bursts') wanted.push({ album, tags: ['smart:bursts'], userAlbum: false });
      } else if (album.type !== 'moment') {
        wanted.push({ album, tags: [`album:${album.id}`], userAlbum: true });
      }
    } else {
      const tags = [`album:${album.id}`];
      if (title === 'screenshots') tags.push('sub:screenshot');
      wanted.push({ album, tags, userAlbum: true });
    }
  }

  const stored = await db.getAllAsync<{ id: string; title: string; count: number; tags: string }>(
    'SELECT id, title, count, tags FROM albums',
  );
  const storedById = new Map(stored.map((a) => [a.id, a]));
  const wantedIds = new Set(wanted.map((w) => w.album.id));

  for (const old of stored) {
    if (wantedIds.has(old.id)) continue;
    const oldTags = old.tags.split(',');
    await db.runAsync(`DELETE FROM asset_tags WHERE tag IN (${marks(oldTags.length)})`, oldTags);
    await db.runAsync('DELETE FROM albums WHERE id = ?', old.id);
  }

  for (const { album, tags, userAlbum } of wanted) {
    const prev = storedById.get(album.id);
    if (!full && prev && prev.count === album.assetCount && prev.title === album.title) continue;

    await db.runAsync(`DELETE FROM asset_tags WHERE tag IN (${marks(tags.length)})`, tags);
    let after: string | undefined;
    for (;;) {
      const page = await MediaLibrary.getAssetsAsync({ album, first: PAGE, after, mediaType: MEDIA });
      await insertTags(page.assets.flatMap((a) => tags.map((t) => [t, a.id] as [string, string])));
      if (!page.hasNextPage || !page.endCursor) break;
      after = page.endCursor;
    }
    await db.runAsync(
      'INSERT OR REPLACE INTO albums (id, title, count, tags, user_album) VALUES (?, ?, ?, ?, ?)',
      album.id,
      album.title,
      album.assetCount,
      tags.join(','),
      userAlbum ? 1 : 0,
    );
  }
}
