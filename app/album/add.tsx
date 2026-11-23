import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoTile } from '../../src/components/PhotoTile';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Text } from '../../src/components/Text';
import { PermissionGate } from '../../src/photos/PermissionGate';
import { usePhotos } from '../../src/photos/usePhotos';
import { photoCount, useShared } from '../../src/shared/store';
import { colors, radius, space } from '../../src/theme';

const COLUMNS = 3;
const MAX = 50;

/** Pick photos from the camera roll to add to a shared album. */
export default function AddPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const album = useShared((s) => s.albums.find((a) => a.id === id));
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Add photos" subtitle={album ? `to ${album.name}` : undefined} />
      <PermissionGate>{album ? <Picker albumId={album.id} /> : null}</PermissionGate>
    </SafeAreaView>
  );
}

function Picker({ albumId }: { albumId: string }) {
  const { width } = useWindowDimensions();
  const { assets, loadMore } = usePhotos();
  const addPhotos = useShared((s) => s.addPhotos);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX) next.add(id);
      return next;
    });
  }, []);

  const add = () => {
    // Videos come later; Drive uploads of big files need background upload.
    addPhotos(
      albumId,
      assets.filter((a) => selected.has(a.id)).map((a) => ({ id: a.id, uri: a.uri })),
    );
    router.back();
  };

  const photos = assets.filter((a) => a.mediaType !== 'video');

  return (
    <View style={{ flex: 1 }}>
      <FlashList
        data={photos}
        numColumns={COLUMNS}
        keyExtractor={(a) => a.id}
        extraData={selected}
        onEndReached={loadMore}
        onEndReachedThreshold={1.5}
        renderItem={({ item }) => (
          <PhotoTile
            id={item.id}
            uri={item.uri}
            size={width / COLUMNS}
            selected={selected.has(item.id)}
            ring
            label={selected.has(item.id) ? 'Selected' : 'Not selected'}
            onPress={toggle}
          />
        )}
      />
      <View style={styles.footer}>
        <Pressable style={[styles.addBtn, !selected.size && { opacity: 0.4 }]} onPress={add} disabled={!selected.size}>
          <Text style={styles.addText}>{selected.size ? `Add ${photoCount(selected.size)}` : 'Choose photos'}</Text>
        </Pressable>
        <Text style={styles.note}>
          {selected.size >= MAX ? `Up to ${MAX} at a time.` : 'Preview: photos stay on this phone for now.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line },
  addBtn: {
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: colors.card, fontSize: 16, fontWeight: '600' },
  note: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 10 },
});
