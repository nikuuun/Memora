import * as MediaLibrary from 'expo-media-library/legacy';
import { Platform } from 'react-native';

export type TypeFilter = 'all' | 'screenshots' | 'videos' | 'live' | 'selfies';

export type PhotoFilter = {
  type: TypeFilter;
  /** null = any year */
  year: number | null;
};

export const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'screenshots', label: 'Screenshots' },
  { value: 'videos', label: 'Videos' },
  // iOS-only smart albums. Android has no equivalent tag.
  ...(Platform.OS === 'ios'
    ? [
        { value: 'live' as const, label: 'Live Photos' },
        { value: 'selfies' as const, label: 'Selfies' },
      ]
    : []),
];

/**
 * Type filters that come for free from the system, no ML.
 * iOS: smart albums. Android: the "Screenshots" folder.
 * Note: smart album titles follow the phone's language; this matches English.
 * When we add a native module we can look them up by type instead of by name.
 */
const ALBUM_TITLES: Partial<Record<TypeFilter, string>> = {
  screenshots: 'Screenshots',
  live: 'Live Photos',
  selfies: 'Selfies',
};

const albumCache = new Map<string, MediaLibrary.Album | null>();

async function findAlbum(title: string) {
  if (albumCache.has(title)) return albumCache.get(title) ?? null;
  const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
  const match = albums.find((a) => a.title.toLowerCase() === title.toLowerCase()) ?? null;
  albumCache.set(title, match);
  return match;
}

export const PAGE_SIZE = 60;

export type Page = { assets: MediaLibrary.Asset[]; endCursor?: string; hasNextPage: boolean };

export async function fetchPage(filter: PhotoFilter, after?: string): Promise<Page> {
  const options: MediaLibrary.AssetsOptions = {
    first: PAGE_SIZE,
    after,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    mediaType:
      filter.type === 'videos'
        ? [MediaLibrary.MediaType.video]
        : [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
  };

  if (filter.year != null) {
    options.createdAfter = new Date(filter.year, 0, 1).getTime();
    options.createdBefore = new Date(filter.year + 1, 0, 1).getTime();
  }

  const albumTitle = ALBUM_TITLES[filter.type];
  if (albumTitle) {
    const album = await findAlbum(albumTitle);
    if (!album) return { assets: [], hasNextPage: false };
    options.album = album;
  }

  const res = await MediaLibrary.getAssetsAsync(options);
  return { assets: res.assets, endCursor: res.endCursor, hasNextPage: res.hasNextPage };
}

/** Every photo matching a filter, page by page. Used for "move all to trash". */
export async function fetchAll(filter: PhotoFilter, onProgress?: (count: number) => void) {
  const all: MediaLibrary.Asset[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await fetchPage(filter, after);
    all.push(...page.assets);
    onProgress?.(all.length);
    if (!page.hasNextPage || !page.endCursor) break;
    after = page.endCursor;
  }
  return all;
}

export function recentYears(count = 10) {
  const now = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => now - i);
}
