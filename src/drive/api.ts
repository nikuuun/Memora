import { File } from 'expo-file-system';

import { getAccessToken, SignedOutError } from './auth';

// Google Drive calls for shared albums.
//   album   = a folder the app made, tagged appProperties.memoraAlbum = "1"
//   members = the folder's user permissions (owner + editors)
//   photo   = an image file in the folder; owners[0] is who added it

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER = 'application/vnd.google-apps.folder';

export type DriveUser = { emailAddress?: string; displayName?: string };
export type DriveFolder = { id: string; name: string; createdTime: string; owners?: DriveUser[] };
export type DrivePhoto = {
  id: string;
  createdTime: string;
  thumbnailLink?: string;
  owners?: DriveUser[];
  appProperties?: Record<string, string>;
};
export type DrivePermission = {
  id: string;
  type: string;
  role: 'owner' | 'writer' | 'reader' | 'commenter' | 'organizer' | 'fileOrganizer';
  emailAddress?: string;
  displayName?: string;
};

export class DriveError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit = {}, retried = false): Promise<T> {
  const token = await getAccessToken(retried);
  const res = await fetch(url.startsWith('http') ? url : `${API}${url}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (res.status === 401 && !retried) return call<T>(url, init, true);
  if (res.status === 401) throw new SignedOutError();
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new DriveError(data?.error?.message ?? `Google Drive error ${res.status}`, res.status);
  return data as T;
}

const enc = encodeURIComponent;
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

// ---- albums ----

/** Albums you made and albums people shared with you. */
export async function listAlbums(): Promise<DriveFolder[]> {
  const base = `appProperties has { key='memoraAlbum' and value='1' } and mimeType='${FOLDER}' and trashed=false`;
  const fields = 'files(id,name,createdTime,owners(emailAddress,displayName))';
  // Two searches, because "shared with me" isn't always included in the first.
  const [mine, shared] = await Promise.all(
    [base, `${base} and sharedWithMe`].map((q) =>
      call<{ files: DriveFolder[] }>(`/files?q=${enc(q)}&fields=${enc(fields)}&pageSize=200`),
    ),
  );
  const byId = new Map<string, DriveFolder>();
  for (const f of [...mine.files, ...shared.files]) byId.set(f.id, f);
  return [...byId.values()];
}

let rootId: string | null = null;

/** The "Memora" folder in your Drive that holds the albums you make. */
async function rootFolder(): Promise<string> {
  if (rootId) return rootId;
  const q = `appProperties has { key='memoraRoot' and value='1' } and 'me' in owners and trashed=false`;
  const found = await call<{ files: { id: string }[] }>(`/files?q=${enc(q)}&fields=files(id)&pageSize=1`);
  rootId =
    found.files[0]?.id ??
    (
      await call<{ id: string }>('/files?fields=id', {
        method: 'POST',
        body: JSON.stringify({ name: 'Memora', mimeType: FOLDER, appProperties: { memoraRoot: '1' } }),
      })
    ).id;
  return rootId;
}

export async function createAlbum(name: string): Promise<DriveFolder> {
  const parent = await rootFolder();
  return call<DriveFolder>(`/files?fields=${enc('id,name,createdTime,owners(emailAddress,displayName)')}`, {
    method: 'POST',
    body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent], appProperties: { memoraAlbum: '1' } }),
  });
}

// ---- people ----

export async function listMembers(albumId: string): Promise<DrivePermission[]> {
  const res = await call<{ permissions: DrivePermission[] }>(
    `/files/${albumId}/permissions?fields=${enc('permissions(id,type,role,emailAddress,displayName)')}`,
  );
  return res.permissions.filter((p) => p.type === 'user');
}

/** Makes them an editor. Google emails them an invite with a link to the folder. */
export async function invite(albumId: string, email: string, albumName: string, from: string) {
  const message = `${from} invited you to the shared album “${albumName}” on Memora. Open Memora and sign in with this Google account to see it and add your photos.`;
  return call<DrivePermission>(
    `/files/${albumId}/permissions?sendNotificationEmail=true&emailMessage=${enc(message)}&fields=${enc('id,type,role,emailAddress,displayName')}`,
    { method: 'POST', body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email }) },
  );
}

/** Removes someone, or yourself (leaving the album). */
export async function removePermission(albumId: string, permissionId: string) {
  await call(`/files/${albumId}/permissions/${permissionId}`, { method: 'DELETE' });
}

// ---- photos ----

export async function listPhotos(albumId: string): Promise<DrivePhoto[]> {
  const q = `'${esc(albumId)}' in parents and trashed=false and mimeType contains 'image/'`;
  const fields = 'files(id,createdTime,thumbnailLink,appProperties,owners(emailAddress,displayName))';
  const res = await call<{ files: DrivePhoto[] }>(
    `/files?q=${enc(q)}&fields=${enc(fields)}&orderBy=createdTime desc&pageSize=1000`,
  );
  return res.files;
}

/** Resumable upload of a local file, streamed from disk. */
export async function uploadPhoto(
  albumId: string,
  localUri: string,
  name: string,
  mime: string,
  batch: string,
): Promise<DrivePhoto> {
  const token = await getAccessToken();
  const start = await fetch(
    `${UPLOAD}?uploadType=resumable&fields=${enc('id,createdTime,owners(emailAddress,displayName),appProperties')}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mime,
      },
      body: JSON.stringify({ name, parents: [albumId], mimeType: mime, appProperties: { memoraBatch: batch } }),
    },
  );
  if (start.status === 401) throw new SignedOutError();
  if (!start.ok) throw new DriveError(`Upload couldn’t start (${start.status})`, start.status);
  const session = start.headers.get('Location') ?? start.headers.get('location');
  if (!session) throw new DriveError('Google Drive didn’t return an upload address.', 500);

  const res = await new File(localUri).upload(session, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': mime },
  });
  if (res.status !== 200 && res.status !== 201) throw new DriveError(`Upload failed (${res.status})`, res.status);
  return JSON.parse(res.body) as DrivePhoto;
}

/**
 * Takes a photo out of the album. Your own photo goes to your Drive bin; someone
 * else's (only the album owner can) is just unlinked from the folder.
 */
export async function removePhoto(albumId: string, photoId: string, mine: boolean) {
  if (mine) await call(`/files/${photoId}`, { method: 'PATCH', body: JSON.stringify({ trashed: true }) });
  else await call(`/files/${photoId}?removeParents=${enc(albumId)}`, { method: 'PATCH', body: '{}' });
}

/** Full-size image URL; needs the Authorization header. */
export const fullUrl = (photoId: string) => `${API}/files/${photoId}?alt=media`;

/** Drive thumbnails end in "=s220"; ask for a bigger one. */
export const thumbUrl = (p: DrivePhoto, size = 600) =>
  p.thumbnailLink ? p.thumbnailLink.replace(/=s\d+$/, `=s${size}`) : fullUrl(p.id);
