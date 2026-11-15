import * as MediaLibrary from 'expo-media-library/legacy';

export const PAGE_SIZE = 60;

export type Page = { assets: MediaLibrary.Asset[]; endCursor?: string; hasNextPage: boolean };

/** One page of the whole library, newest first. Used by the Library grid. */
export async function fetchPage(after?: string): Promise<Page> {
  const res = await MediaLibrary.getAssetsAsync({
    first: PAGE_SIZE,
    after,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
  });
  return { assets: res.assets, endCursor: res.endCursor, hasNextPage: res.hasNextPage };
}
