import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { PhotoTile } from '../../src/components/PhotoTile';
import { PermissionGate } from '../../src/photos/PermissionGate';
import { usePhotos } from '../../src/photos/usePhotos';
import { toQueued, useTrash, useTrashCount } from '../../src/trash/store';
import { colors, space } from '../../src/theme';

const COLUMNS = 3;
const ALL = { type: 'all', year: null } as const;

/** Library: the familiar grid. Long-press to start selecting, then move to trash. */
export default function LibraryScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PermissionGate>
        <Library />
      </PermissionGate>
    </SafeAreaView>
  );
}

function Library() {
  const { width } = useWindowDimensions();
  const size = width / COLUMNS;
  const { assets, loadMore } = usePhotos(ALL);
  const queue = useTrash((s) => s.queue);
  const trash = useTrash((s) => s.trash);
  const restore = useTrash((s) => s.restore);
  const trashCount = useTrashCount();

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onPress = useCallback(
    (id: string) => {
      if (selecting) toggle(id);
      else if (queue[id]) restore([id]); // tap a trashed photo to take it back out
      // TODO: open a full-screen photo viewer
    },
    [selecting, toggle, queue, restore],
  );

  const onLongPress = useCallback(
    (id: string) => {
      setSelecting(true);
      toggle(id);
    },
    [toggle],
  );

  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const moveToTrash = () => {
    trash(assets.filter((a) => selected.has(a.id)).map(toQueued));
    exitSelect();
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        {selecting ? (
          <>
            <Pressable onPress={exitSelect} hitSlop={8}>
              <Text style={styles.action}>Cancel</Text>
            </Pressable>
            <Text style={styles.count}>{selected.size} selected</Text>
            <Pressable onPress={moveToTrash} disabled={selected.size === 0} hitSlop={8}>
              <Text style={[styles.action, { color: colors.danger, opacity: selected.size ? 1 : 0.4 }]}>
                Trash
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Library</Text>
            {trashCount > 0 && (
              <Pressable onPress={() => router.push('/review')} hitSlop={8}>
                <Text style={styles.action}>Review {trashCount}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      <FlatList
        data={assets}
        keyExtractor={(a) => a.id}
        numColumns={COLUMNS}
        renderItem={({ item }) => (
          <PhotoTile
            id={item.id}
            uri={item.uri}
            size={size}
            isVideo={item.mediaType === 'video'}
            queued={!!queue[item.id]}
            selected={selected.has(item.id)}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        )}
        getItemLayout={(_, index) => ({
          length: size,
          offset: size * Math.floor(index / COLUMNS),
          index,
        })}
        onEndReached={loadMore}
        onEndReachedThreshold={1.5}
        windowSize={9}
        removeClippedSubviews
        extraData={{ selected, queue, selecting }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  count: { fontSize: 16, fontWeight: '600', color: colors.text },
  action: { fontSize: 16, color: colors.text },
});
