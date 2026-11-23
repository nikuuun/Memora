import { create } from 'zustand';

// Shared albums. For now this is sample data kept in memory, so the screens can
// be tried without signing in. Each field maps onto Google Drive later:
//   Album        → a Drive folder the app created (name = folder name)
//   members      → the folder's permissions (owner + editors, by Google email)
//   SharedPhoto  → a file in the folder (addedBy = who uploaded it, addedAt = createdTime)

export type Role = 'owner' | 'editor';
export type Member = { email: string; name?: string; role: Role };
export type SharedPhoto = { id: string; uri: string; addedBy: string; addedAt: number };
export type Album = { id: string; name: string; createdAt: number; members: Member[]; photos: SharedPhoto[] };

/** The signed-in person. Becomes the Google account after sign-in is added. */
export const ME = 'you@example.com';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Same pictures as linhant's Figma prototype.
// fm=jpg so a saved copy is a normal JPEG the Photos app accepts.
const pic = (id: string) => `https://images.unsplash.com/${id}?fm=jpg&w=1600&q=80`;
const P = {
  beach: pic('photo-1553670440-f4fa1dfeabf4'),
  walk: pic('photo-1725975735073-61ae4e150312'),
  field: pic('photo-1615574147300-62cc3e37868f'),
  coast: pic('photo-1700908608272-14425ac565e9'),
  path: pic('photo-1734660264096-c1cc4768454f'),
};

let nextId = 1;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${nextId++}`;

function batch(by: string, ago: number, uris: string[]): SharedPhoto[] {
  const at = Date.now() - ago;
  return uris.map((uri) => ({ id: newId('p'), uri, addedBy: by, addedAt: at }));
}

function sampleAlbums(): Album[] {
  return [
    {
      id: 'saltwater',
      name: 'Saltwater days',
      createdAt: Date.now() - 9 * DAY,
      members: [
        { email: ME, name: 'You', role: 'owner' },
        { email: 'jamie@example.com', name: 'Jamie Lee', role: 'editor' },
        { email: 'priya@example.com', name: 'Priya Shah', role: 'editor' },
      ],
      photos: [
        ...batch('jamie@example.com', 12 * MIN, [P.beach, P.coast, P.walk, P.path, P.field, P.beach, P.coast, P.walk]),
        ...batch('priya@example.com', 2 * DAY, [P.field, P.path, P.coast]),
        ...batch(ME, 8 * DAY, [P.walk, P.beach, P.path, P.field]),
      ],
    },
    {
      id: 'sunday',
      name: 'Sunday, slowly',
      createdAt: Date.now() - 20 * DAY,
      members: [
        { email: ME, name: 'You', role: 'owner' },
        { email: 'alex@example.com', name: 'Alex Kim', role: 'editor' },
      ],
      photos: [...batch('alex@example.com', 5 * HOUR, [P.walk, P.field]), ...batch(ME, 19 * DAY, [P.path, P.walk, P.beach])],
    },
    {
      id: 'south',
      name: 'Somewhere south',
      createdAt: Date.now() - 40 * DAY,
      members: [
        { email: 'maya@example.com', name: 'Maya Ortiz', role: 'owner' },
        { email: ME, name: 'You', role: 'editor' },
        { email: 'jamie@example.com', name: 'Jamie Lee', role: 'editor' },
        { email: 'sam@example.com', name: 'Sam Rivera', role: 'editor' },
      ],
      photos: [
        ...batch('sam@example.com', 3 * DAY, [P.coast, P.field]),
        ...batch('maya@example.com', 38 * DAY, [P.coast, P.beach, P.path, P.walk, P.field]),
      ],
    },
  ];
}

type SharedState = {
  albums: Album[];
  createAlbum: (name: string, emails: string[]) => string;
  addPhotos: (albumId: string, photos: { id: string; uri: string }[]) => void;
  removePhoto: (albumId: string, photoId: string) => void;
  invite: (albumId: string, emails: string[]) => void;
  removeMember: (albumId: string, email: string) => void;
  leave: (albumId: string) => void;
};

const update = (albums: Album[], id: string, fn: (a: Album) => Album) => albums.map((a) => (a.id === id ? fn(a) : a));

export const useShared = create<SharedState>()((set) => ({
  albums: sampleAlbums(),

  createAlbum: (name, emails) => {
    const id = newId('a');
    const album: Album = {
      id,
      name,
      createdAt: Date.now(),
      members: [{ email: ME, name: 'You', role: 'owner' }, ...emails.map((email) => ({ email, role: 'editor' as const }))],
      photos: [],
    };
    set((s) => ({ albums: [album, ...s.albums] }));
    return id;
  },

  addPhotos: (albumId, photos) => {
    const at = Date.now();
    set((s) => ({
      albums: update(s.albums, albumId, (a) => ({
        ...a,
        photos: [...photos.map((p) => ({ id: newId('p'), uri: p.uri, addedBy: ME, addedAt: at })), ...a.photos],
      })),
    }));
  },

  removePhoto: (albumId, photoId) =>
    set((s) => ({
      albums: update(s.albums, albumId, (a) => ({ ...a, photos: a.photos.filter((p) => p.id !== photoId) })),
    })),

  invite: (albumId, emails) =>
    set((s) => ({
      albums: update(s.albums, albumId, (a) => {
        const have = new Set(a.members.map((m) => m.email));
        const fresh = emails.filter((e) => !have.has(e)).map((email) => ({ email, role: 'editor' as const }));
        return { ...a, members: [...a.members, ...fresh] };
      }),
    })),

  removeMember: (albumId, email) =>
    set((s) => ({
      albums: update(s.albums, albumId, (a) => ({ ...a, members: a.members.filter((m) => m.email !== email) })),
    })),

  leave: (albumId) => set((s) => ({ albums: s.albums.filter((a) => a.id !== albumId) })),
}));

// ---- helpers used by the screens ----

export const isOwner = (album: Album, email = ME) => album.members.some((m) => m.email === email && m.role === 'owner');

/** You can take out photos you added; the album's owner can take out any. */
export const canRemove = (album: Album, photo: SharedPhoto, email = ME) => photo.addedBy === email || isOwner(album, email);

/** Photos you added from this phone are already in your Photos app. */
export const isOnThisPhone = (photo: SharedPhoto) => !/^https?:/.test(photo.uri);

/** "You", a first name, or the part of the email before the @. */
export function displayName(album: Album, email: string) {
  if (email === ME) return 'You';
  const m = album.members.find((x) => x.email === email);
  return m?.name?.split(' ')[0] ?? email.split('@')[0];
}

export function initials(album: Album, email: string) {
  if (email === ME) return 'ME';
  const m = album.members.find((x) => x.email === email);
  const source = m?.name ?? email.split('@')[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export const photoCount = (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'}`;
export const peopleCount = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;

export function timeAgo(at: number) {
  const d = Date.now() - at;
  if (d < MIN) return 'now';
  if (d < HOUR) return `${Math.floor(d / MIN)}m`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h`;
  return `${Math.floor(d / DAY)}d`;
}

export type Activity = { key: string; album: Album; by: string; count: number; at: number };

/** One row per upload batch ("Jamie added 8 photos"), newest first. */
export function recentActivity(albums: Album[], limit = 4): Activity[] {
  const rows = new Map<string, Activity>();
  for (const album of albums) {
    for (const p of album.photos) {
      const key = `${album.id}|${p.addedBy}|${p.addedAt}`;
      const row = rows.get(key);
      if (row) row.count += 1;
      else rows.set(key, { key, album, by: p.addedBy, count: 1, at: p.addedAt });
    }
  }
  return [...rows.values()].sort((a, b) => b.at - a.at).slice(0, limit);
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

/** A stable soft colour per person, from the Figma palette. */
const TONES = ['#D9A08B', '#A9BC90', '#B4A3BD', '#D6B676', '#9FB4BF', '#C9A9A6'];
export function tone(email: string) {
  let h = 0;
  for (const ch of email) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}
