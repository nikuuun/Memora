import { getDb, STATUS, type Row } from './db';

/**
 * Keyword search over the database.
 *
 * Keyword ids:
 *   type:screenshots | type:videos | type:longvideos | type:live | type:selfies | type:bursts
 *   album:<albumId>
 *   year:<yyyy>
 *
 * Types and albums are "what" keywords and combine with OR (Screenshots +
 * WhatsApp = both). Years combine with OR among themselves and narrow the
 * "what" (Screenshots + 2024 = screenshots from 2024).
 */

export type Scope = 'todo' | 'reviewed';
export type Filter = { scope: Scope; tags: string[] };
export type Tag = { id: string; label: string; kind: 'type' | 'album' | 'year'; count: number };
export type Thumb = { id: string; uri: string };
export type Group = { key: string; title: string; sub: string; count: number; filter: Filter; thumbs: Thumb[] };

export const LONG_VIDEO_SECONDS = 60;

const TYPES: { id: string; label: string; source?: string }[] = [
  { id: 'type:screenshots', label: 'Screenshots', source: 'sub:screenshot' },
  { id: 'type:videos', label: 'Videos' },
  { id: 'type:longvideos', label: 'Long videos' },
  { id: 'type:screenrecordings', label: 'Screen recordings', source: 'smart:screenrecordings' },
  { id: 'type:favorites', label: 'Favorites', source: 'smart:favorites' },
  { id: 'type:selfies', label: 'Selfies', source: 'smart:selfies' },
  { id: 'type:live', label: 'Live Photos', source: 'sub:live' },
  { id: 'type:portrait', label: 'Portrait', source: 'sub:portrait' },
  { id: 'type:bursts', label: 'Bursts', source: 'smart:bursts' },
  { id: 'type:panorama', label: 'Panoramas', source: 'sub:panorama' },
  { id: 'type:slomo', label: 'Slo-mo', source: 'sub:slomo' },
  { id: 'type:timelapse', label: 'Time-lapse', source: 'sub:timelapse' },
  { id: 'type:cinematic', label: 'Cinematic', source: 'sub:cinematic' },
  { id: 'type:spatial', label: 'Spatial', source: 'sub:spatial' },
  { id: 'type:animated', label: 'Animated', source: 'smart:animated' },
  { id: 'type:longexposure', label: 'Long exposure', source: 'smart:longexposure' },
  { id: 'type:raw', label: 'RAW', source: 'smart:raw' },
];

const scopeStatus = (scope: Scope) => (scope === 'todo' ? STATUS.todo : STATUS.reviewed);
const hasTag = 'EXISTS (SELECT 1 FROM asset_tags t WHERE t.tag = ? AND t.asset_id = a.id)';

function tagCondition(tag: string): { sql: string; params: (string | number)[] } {
  if (tag.startsWith('year:')) return { sql: 'a.year = ?', params: [Number(tag.slice(5))] };
  if (tag.startsWith('album:')) return { sql: hasTag, params: [tag] };
  if (tag === 'type:videos') return { sql: "a.media_type = 'video'", params: [] };
  if (tag === 'type:longvideos') return { sql: `a.media_type = 'video' AND a.duration >= ${LONG_VIDEO_SECONDS}`, params: [] };
  const source = TYPES.find((t) => t.id === tag)?.source;
  return source ? { sql: hasTag, params: [source] } : { sql: '0', params: [] };
}

export function where(filter: Filter) {
  const conds = ['a.status = ?'];
  const params: (string | number)[] = [scopeStatus(filter.scope)];
  const what = filter.tags.filter((t) => !t.startsWith('year:'));
  const years = filter.tags.filter((t) => t.startsWith('year:'));
  for (const list of [what, years]) {
    if (!list.length) continue;
    const parts = list.map(tagCondition);
    conds.push(`(${parts.map((p) => `(${p.sql})`).join(' OR ')})`);
    params.push(...parts.flatMap((p) => p.params));
  }
  return { sql: conds.join(' AND '), params };
}

export async function scopeCounts() {
  const db = await getDb();
  const rows = await db.getAllAsync<{ status: number; n: number }>('SELECT status, COUNT(*) AS n FROM assets GROUP BY status');
  const get = (s: number) => rows.find((r) => r.status === s)?.n ?? 0;
  return { todo: get(STATUS.todo), reviewed: get(STATUS.reviewed), marked: get(STATUS.marked) };
}

/** Every keyword that has something in this scope, with its count. */
export async function loadTags(scope: Scope): Promise<Tag[]> {
  const db = await getDb();
  const status = scopeStatus(scope);
  const [tagRows, videoRow, yearRows, albums] = await Promise.all([
    db.getAllAsync<{ tag: string; n: number }>(
      'SELECT t.tag AS tag, COUNT(*) AS n FROM asset_tags t JOIN assets a ON a.id = t.asset_id WHERE a.status = ? GROUP BY t.tag',
      status,
    ),
    db.getFirstAsync<{ videos: number | null; longvideos: number | null }>(
      `SELECT SUM(media_type = 'video') AS videos,
              SUM(media_type = 'video' AND duration >= ${LONG_VIDEO_SECONDS}) AS longvideos
       FROM assets WHERE status = ?`,
      status,
    ),
    db.getAllAsync<{ year: number; n: number }>(
      'SELECT year, COUNT(*) AS n FROM assets WHERE status = ? AND year > 1990 GROUP BY year ORDER BY year DESC',
      status,
    ),
    db.getAllAsync<{ id: string; title: string }>('SELECT id, title FROM albums WHERE user_album = 1'),
  ]);
  const tagCount = new Map(tagRows.map((r) => [r.tag, r.n]));

  const types: Tag[] = TYPES.map((t) => ({
    id: t.id,
    label: t.label,
    kind: 'type' as const,
    count:
      t.id === 'type:videos'
        ? (videoRow?.videos ?? 0)
        : t.id === 'type:longvideos'
          ? (videoRow?.longvideos ?? 0)
          : (tagCount.get(t.source!) ?? 0),
  }));
  const albumTags: Tag[] = albums
    .map((a) => ({ id: `album:${a.id}`, label: a.title, kind: 'album' as const, count: tagCount.get(`album:${a.id}`) ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const yearTags: Tag[] = yearRows.map((y) => ({ id: `year:${y.year}`, label: String(y.year), kind: 'year' as const, count: y.n }));

  return [...types, ...albumTags, ...yearTags].filter((t) => t.count > 0);
}

export async function countWhere(filter: Filter) {
  const db = await getDb();
  const w = where(filter);
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM assets a WHERE ${w.sql}`, w.params);
  return row?.n ?? 0;
}

async function thumbs(filter: Filter, limit = 5): Promise<Thumb[]> {
  const db = await getDb();
  const w = where(filter);
  return db.getAllAsync<Thumb>(`SELECT a.id, a.uri FROM assets a WHERE ${w.sql} ORDER BY a.created DESC LIMIT ${limit}`, w.params);
}

/** Every item matching a filter, newest first. Used by the grid and one-by-one screens. */
export async function rowsWhere(filter: Filter): Promise<Row[]> {
  const db = await getDb();
  const w = where(filter);
  return db.getAllAsync<Row>(
    `SELECT a.id, a.uri, a.media_type, a.duration, a.status FROM assets a WHERE ${w.sql} ORDER BY a.created DESC`,
    w.params,
  );
}

export async function markedRows(): Promise<Row[]> {
  const db = await getDb();
  return db.getAllAsync<Row>(
    'SELECT id, uri, media_type, duration, status FROM assets WHERE status = ? ORDER BY status_at DESC, created DESC',
    STATUS.marked,
  );
}

export async function markedIds(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM assets WHERE status = ?', STATUS.marked);
  return new Set(rows.map((r) => r.id));
}

const MAX_SUGGESTED = 16;

/**
 * Results for the current keywords.
 * - No keywords: one group per type and album (biggest first).
 * - One year only: that year split by type and album.
 * - Otherwise: the match split by year, newest first.
 */
export async function loadResults(scope: Scope, selected: string[], tags: Tag[]) {
  const label = (id: string) => tags.find((t) => t.id === id)?.label ?? id.replace(/^\w+:/, '');
  const whatTags = tags.filter((t) => t.kind !== 'year');
  const db = await getDb();

  let groups: Omit<Group, 'thumbs'>[] = [];
  let match: { count: number; filter: Filter; label: string } | null = null;

  if (!selected.length) {
    const types = whatTags.filter((t) => t.kind === 'type');
    const albums = whatTags.filter((t) => t.kind === 'album').slice(0, Math.max(0, MAX_SUGGESTED - types.length));
    groups = [...types, ...albums].map((t) => ({
      key: t.id,
      title: t.label,
      sub: 'All years',
      count: t.count,
      filter: { scope, tags: [t.id] },
    }));
  } else {
    const filter = { scope, tags: selected };
    match = { count: await countWhere(filter), filter, label: selected.map(label).join(', ') };
    const what = selected.filter((t) => !t.startsWith('year:'));
    const years = selected.filter((t) => t.startsWith('year:'));

    if (years.length === 1 && what.length === 0) {
      const counted = await Promise.all(
        whatTags.map(async (t) => ({ t, count: await countWhere({ scope, tags: [t.id, years[0]] }) })),
      );
      groups = counted
        .filter((c) => c.count > 0)
        .slice(0, MAX_SUGGESTED)
        .map(({ t, count }) => ({
          key: t.id,
          title: t.label,
          sub: label(years[0]),
          count,
          filter: { scope, tags: [t.id, years[0]] },
        }));
    } else {
      const w = where(filter);
      const byYear = await db.getAllAsync<{ year: number; n: number }>(
        `SELECT a.year AS year, COUNT(*) AS n FROM assets a WHERE ${w.sql} GROUP BY a.year ORDER BY a.year DESC`,
        w.params,
      );
      const title = what.length ? what.map(label).join(' + ') : 'Everything';
      groups = byYear.map((y) => ({
        key: `year:${y.year}`,
        title,
        sub: y.year > 1990 ? String(y.year) : 'No date',
        count: y.n,
        filter: { scope, tags: [...what, `year:${y.year}`] },
      }));
    }
  }

  const withThumbs: Group[] = await Promise.all(groups.map(async (g) => ({ ...g, thumbs: await thumbs(g.filter) })));
  return { match, groups: withThumbs };
}
