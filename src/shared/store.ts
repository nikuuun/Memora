import { File } from 'expo-file-system';
import type { ImageSource } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library/legacy';
import { create } from 'zustand';

import * as drive from '../drive/api';
import { currentToken, getAccessToken, restoreSignIn, SignedOutError, signOut, useAuth } from '../drive/auth';
import { UPLOAD_CONCURRENCY, UPLOAD_MAX_SIDE, UPLOAD_QUALITY } from '../drive/config';
import { SAMPLE_ME, sampleAlbums } from './samples';

// Shared albums. Signed in with Google, they live in Google Drive:
//   Album        → a folder the app made (name = folder name)
//   members      → the folder's permissions (owner + editors, by Google email)
//   SharedPhoto  → an image in the folder (addedBy = who uploaded it)
// Signed out, the same screens show sample albums kept in memory.

export type Role = 'owner' | 'editor';
export type Member = { email: string; role: Role; permissionId?: string };
export type SharedPhoto = {
  id: string;
  /** Grid-size image. */
  uri: string;
  /** Full-size image, when different from `uri`. */
  full?: string;
  /** Drive images need the Google token in the request. */
  auth?: boolean;
  addedBy: string;
  addedAt: number;
  /** Photos added together share a batch ("Jamie added 8 photos"). */
  batch?: string;
  /** Just added here; kept until Drive's search catches up. */
  localUntil?: number;
};
export type Album = {
  id: string;
  source: 'sample' | 'drive';
  name: string;
  createdAt: number;
  members: Member[];
  photos: SharedPhoto[];
  /** Display names we know, by email. */
  names: Record<string, string>;
  localUntil?: number;
};

const KEEP_LOCAL_MS = 2 * 60_000;

type SharedState = {
  mode: 'sample' | 'drive';
  /** Email of the person using the app. */
  me: string;
  albums: Album[];
  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  createAlbum: (name: string, emails: string[]) => Promise<{ id: string; failed: string[] }>;
  addPhotos: (
    albumId: string,
    assets: { id: string; uri: string }[],
    onProgress?: (done: number, total: number) => void,
  ) => Promise<{ failed: number }>;
  removePhoto: (albumId: string, photoId: string) => Promise<void>;
  invite: (albumId: string, emails: string[]) => Promise<{ failed: string[] }>;
  removeMember: (albumId: string, email: string) => Promise<void>;
  leave: (albumId: string) => Promise<void>;
};

const update = (albums: Album[], id: string, fn: (a: Album) => Album) => albums.map((a) => (a.id === id ? fn(a) : a));
const lastActive = (a: Album) => Math.max(a.createdAt, ...a.photos.map((p) => p.addedAt));
const sortAlbums = (albums: Album[]) => [...albums].sort((a, b) => lastActive(b) - lastActive(a));

const message = (e: unknown) =>
  e instanceof SignedOutError ? e.message : e instanceof Error ? e.message : 'Something went wrong. Please try again.';

// ---- Drive → app shapes ----

const emailOf = (u?: drive.DriveUser) => (u?.emailAddress ?? u?.displayName ?? 'someone').toLowerCase();

function toPhoto(p: drive.DrivePhoto): SharedPhoto {
  return {
    id: p.id,
    uri: drive.thumbUrl(p),
    full: drive.fullUrl(p.id),
    auth: true,
    addedBy: emailOf(p.owners?.[0]),
    addedAt: Date.parse(p.createdTime),
    batch: p.appProperties?.memoraBatch,
  };
}

function toAlbum(f: drive.DriveFolder, perms: drive.DrivePermission[], files: drive.DrivePhoto[]): Album {
  const names: Record<string, string> = {};
  const owner = f.owners?.[0];
  if (owner?.displayName) names[emailOf(owner)] = owner.displayName;
  for (const p of perms) if (p.displayName && p.emailAddress) names[p.emailAddress.toLowerCase()] = p.displayName;
  for (const file of files) {
    const u = file.owners?.[0];
    if (u?.displayName) names[emailOf(u)] = u.displayName;
  }

  let members: Member[] = perms.map((p) => ({
    email: (p.emailAddress ?? p.displayName ?? p.id).toLowerCase(),
    role: p.role === 'owner' ? 'owner' : 'editor',
    permissionId: p.id,
  }));
  // Editors can't always read the full list; at least show the owner.
  if (!members.length && owner) members = [{ email: emailOf(owner), role: 'owner' }];
  members.sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0));

  return {
    id: f.id,
    source: 'drive',
    name: f.name,
    createdAt: Date.parse(f.createdTime),
    members,
    photos: files.map(toPhoto),
    names,
  };
}

/** Keeps photos and albums added on this phone that Drive's search hasn't caught up with. */
function mergeLocal(local: Album[], fetched: Album[]): Album[] {
  const now = Date.now();
  const byId = new Map(fetched.map((a) => [a.id, a]));
  const out = fetched.map((a) => {
    const before = local.find((x) => x.id === a.id);
    if (!before) return a;
    const have = new Set(a.photos.map((p) => p.id));
    const extra = before.photos.filter((p) => p.localUntil && p.localUntil > now && !have.has(p.id));
    return extra.length ? { ...a, photos: [...extra, ...a.photos] } : a;
  });
  for (const a of local) if (a.localUntil && a.localUntil > now && !byId.has(a.id)) out.push(a);
  return sortAlbums(out);
}

// ---- uploading ----

/** Makes a JPEG copy of a camera-roll photo, at most UPLOAD_MAX_SIDE on the long side. */
async function prepare(asset: { id: string; uri: string }) {
  const info = await MediaLibrary.getAssetInfoAsync(asset.id, { shouldDownloadFromNetwork: true });
  const sources = [info.localUri, asset.uri].filter((s): s is string => !!s);
  let lastError: unknown;
  for (const src of sources) {
    try {
      const ref = await ImageManipulator.ImageManipulator.manipulate(src, {
        maxWidth: UPLOAD_MAX_SIDE,
        maxHeight: UPLOAD_MAX_SIDE,
      }).renderAsync();
      const out = await ref.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: UPLOAD_QUALITY });
      const base = (info.filename ?? 'photo').replace(/\.[^.]+$/, '');
      return { uri: out.uri, name: `${base}.jpg` };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('Couldn’t read the photo.');
}

// ---- the store ----

export const useShared = create<SharedState>()((set, get) => {
  /** Sign-out or an expired sign-in: back to the samples. */
  const toSamples = (error: string | null = null) =>
    set({ mode: 'sample', me: SAMPLE_ME, albums: sampleAlbums(), loading: false, error });

  const failed = async (e: unknown) => {
    if (e instanceof SignedOutError) {
      toSamples(e.message);
      await signOut();
    }
    throw new Error(message(e));
  };

  return {
    mode: 'sample',
    me: SAMPLE_ME,
    albums: sampleAlbums(),
    loading: false,
    error: null,

    refresh: async () => {
      const account = useAuth.getState().account;
      if (!account) {
        if (get().mode === 'drive') toSamples();
        return;
      }
      if (get().mode !== 'drive') set({ mode: 'drive', me: account.email, albums: [] });
      set({ loading: true, error: null });
      try {
        await getAccessToken();
        const folders = await drive.listAlbums();
        const albums = await Promise.all(
          folders.map(async (f) => {
            const [perms, files] = await Promise.all([
              drive.listMembers(f.id).catch(() => [] as drive.DrivePermission[]),
              drive.listPhotos(f.id),
            ]);
            return toAlbum(f, perms, files);
          }),
        );
        set({ albums: mergeLocal(get().albums, albums), loading: false });
      } catch (e) {
        if (e instanceof SignedOutError) {
          toSamples(e.message);
          return;
        }
        set({ loading: false, error: message(e) });
      }
    },

    createAlbum: async (name, emails) => {
      if (get().mode === 'sample') {
        const id = `sample-album-${Date.now()}`;
        const album: Album = {
          id,
          source: 'sample',
          name,
          createdAt: Date.now(),
          names: { [SAMPLE_ME]: 'You' },
          members: [{ email: SAMPLE_ME, role: 'owner' }, ...emails.map((email) => ({ email, role: 'editor' as const }))],
          photos: [],
        };
        set((s) => ({ albums: [album, ...s.albums] }));
        return { id, failed: [] };
      }
      try {
        const f = await drive.createAlbum(name);
        const account = useAuth.getState().account;
        const album: Album = {
          ...toAlbum(f, [], []),
          members: [{ email: get().me, role: 'owner' }],
          names: account?.name ? { [get().me]: account.name } : {},
          localUntil: Date.now() + KEEP_LOCAL_MS,
        };
        set((s) => ({ albums: [album, ...s.albums] }));
        const { failed: notInvited } = await get().invite(f.id, emails);
        return { id: f.id, failed: notInvited };
      } catch (e) {
        return failed(e);
      }
    },

    addPhotos: async (albumId, assets, onProgress) => {
      const me = get().me;
      const batch = String(Date.now());
      if (get().mode === 'sample') {
        const at = Date.now();
        set((s) => ({
          albums: update(s.albums, albumId, (a) => ({
            ...a,
            photos: [
              ...assets.map((p, i) => ({ id: `sample-add-${at}-${i}`, uri: p.uri, addedBy: me, addedAt: at, batch })),
              ...a.photos,
            ],
          })),
        }));
        return { failed: 0 };
      }

      let next = 0;
      let done = 0;
      let bad = 0;
      let signedOut: unknown = null;
      onProgress?.(0, assets.length);

      const worker = async () => {
        while (!signedOut) {
          const i = next++;
          if (i >= assets.length) return;
          const asset = assets[i];
          try {
            const file = await prepare(asset);
            try {
              const up = await drive.uploadPhoto(albumId, file.uri, file.name, 'image/jpeg', batch);
              // Show the phone's own copy until Drive has a thumbnail ready.
              const photo: SharedPhoto = {
                id: up.id,
                uri: asset.uri,
                addedBy: me,
                addedAt: Date.now(),
                batch,
                localUntil: Date.now() + KEEP_LOCAL_MS,
              };
              set((s) => ({ albums: update(s.albums, albumId, (a) => ({ ...a, photos: [photo, ...a.photos] })) }));
            } finally {
              try {
                new File(file.uri).delete();
              } catch {
                // temp file already gone
              }
            }
          } catch (e) {
            if (e instanceof SignedOutError) signedOut = e;
            else bad += 1;
          }
          done += 1;
          onProgress?.(done, assets.length);
        }
      };
      await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, assets.length) }, worker));
      if (signedOut) return failed(signedOut);
      return { failed: bad };
    },

    removePhoto: async (albumId, photoId) => {
      const album = get().albums.find((a) => a.id === albumId);
      const photo = album?.photos.find((p) => p.id === photoId);
      if (!album || !photo) return;
      if (album.source === 'drive') {
        try {
          await drive.removePhoto(albumId, photoId, photo.addedBy === get().me);
        } catch (e) {
          return failed(e);
        }
      }
      set((s) => ({
        albums: update(s.albums, albumId, (a) => ({ ...a, photos: a.photos.filter((p) => p.id !== photoId) })),
      }));
    },

    invite: async (albumId, emails) => {
      const album = get().albums.find((a) => a.id === albumId);
      if (!album) return { failed: emails };
      const fresh = emails.filter((e) => !album.members.some((m) => m.email === e));
      if (album.source === 'sample') {
        set((s) => ({
          albums: update(s.albums, albumId, (a) => ({
            ...a,
            members: [...a.members, ...fresh.map((email) => ({ email, role: 'editor' as const }))],
          })),
        }));
        return { failed: [] };
      }
      const account = useAuth.getState().account;
      const from = account?.name ?? account?.email ?? 'A friend';
      const added: Member[] = [];
      const notInvited: string[] = [];
      for (const email of fresh) {
        try {
          const p = await drive.invite(albumId, email, album.name, from);
          added.push({ email, role: 'editor', permissionId: p.id });
        } catch (e) {
          if (e instanceof SignedOutError) return failed(e);
          notInvited.push(email);
        }
      }
      set((s) => ({ albums: update(s.albums, albumId, (a) => ({ ...a, members: [...a.members, ...added] })) }));
      return { failed: notInvited };
    },

    removeMember: async (albumId, email) => {
      const album = get().albums.find((a) => a.id === albumId);
      const member = album?.members.find((m) => m.email === email);
      if (!album || !member) return;
      if (album.source === 'drive') {
        if (!member.permissionId) throw new Error('Couldn’t find that person’s access. Pull down to refresh and try again.');
        try {
          await drive.removePermission(albumId, member.permissionId);
        } catch (e) {
          return failed(e);
        }
      }
      set((s) => ({
        albums: update(s.albums, albumId, (a) => ({ ...a, members: a.members.filter((m) => m.email !== email) })),
      }));
    },

    leave: async (albumId) => {
      const album = get().albums.find((a) => a.id === albumId);
      if (!album) return;
      if (album.source === 'drive') {
        const mine = album.members.find((m) => m.email === get().me);
        if (!mine?.permissionId) throw new Error('Couldn’t find your access to this album. Pull down to refresh and try again.');
        try {
          await drive.removePermission(albumId, mine.permissionId);
        } catch (e) {
          return failed(e);
        }
      }
      set((s) => ({ albums: s.albums.filter((a) => a.id !== albumId) }));
    },
  };
});

/** At start-up: restore the saved Google sign-in, then load albums from Drive. */
export async function initShared() {
  await restoreSignIn();
  if (useAuth.getState().status === 'signedIn') await useShared.getState().refresh();
}

/** After signing in or out on the Shared tab. */
export async function afterSignIn() {
  await useShared.getState().refresh();
}
export async function afterSignOut() {
  await signOut();
  useShared.setState({ mode: 'sample', me: SAMPLE_ME, albums: sampleAlbums(), error: null, loading: false });
}

// ---- helpers used by the screens ----

const me = () => useShared.getState().me;

export const isMe = (email: string) => email === me();

export const isOwner = (album: Album, email = me()) => album.members.some((m) => m.email === email && m.role === 'owner');

/** You can take out photos you added; the album's owner can take out any. */
export const canRemove = (album: Album, photo: SharedPhoto) => photo.addedBy === me() || isOwner(album);

/** Photos you added from this phone are already in your Photos app. */
export const isOnThisPhone = (photo: SharedPhoto) => !/^https?:/.test(photo.uri);

/** Image source for expo-image, with the Google token for Drive photos. */
export function imageSource(photo: SharedPhoto, size: 'thumb' | 'full' = 'thumb'): ImageSource {
  const uri = size === 'full' ? (photo.full ?? photo.uri) : photo.uri;
  return {
    uri,
    cacheKey: `${photo.id}-${size}`,
    headers: photo.auth ? { Authorization: `Bearer ${currentToken()}` } : undefined,
  };
}

/** Full name if we know it, else the email. */
export function fullName(album: Album, email: string) {
  if (isMe(email)) return 'You';
  return album.names[email] ?? email;
}

/** "You", a first name, or the part of the email before the @. */
export function displayName(album: Album, email: string) {
  if (isMe(email)) return 'You';
  return album.names[email]?.split(' ')[0] ?? email.split('@')[0];
}

export function initials(album: Album, email: string) {
  if (isMe(email)) return 'ME';
  const source = album.names[email] ?? email.split('@')[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export const photoCount = (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'}`;
export const peopleCount = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

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
      // Photos without a batch tag (added in Drive itself) group by the hour.
      const group = p.batch ?? String(Math.floor(p.addedAt / HOUR));
      const key = `${album.id}|${p.addedBy}|${group}`;
      const row = rows.get(key);
      if (row) {
        row.count += 1;
        row.at = Math.max(row.at, p.addedAt);
      } else rows.set(key, { key, album, by: p.addedBy, count: 1, at: p.addedAt });
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
