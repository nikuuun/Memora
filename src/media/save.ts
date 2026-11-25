import * as MediaLibrary from 'expo-media-library/legacy';

const ALBUM = 'Memora';

/**
 * Saves an image file to Photos and files it in a "Memora" album, so camera
 * shots and stories are easy to find. If the album step fails, the photo is
 * still saved to the library.
 */
export async function saveToMemora(uri: string): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  if (!perm.granted) throw new Error('Allow Memora to add photos in Settings to save.');
  const asset = await MediaLibrary.createAssetAsync(uri);
  try {
    const album = await MediaLibrary.getAlbumAsync(ALBUM);
    if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    else await MediaLibrary.createAlbumAsync(ALBUM, asset, false);
  } catch (e) {
    console.warn('Adding to the Memora album failed', e);
  }
}
