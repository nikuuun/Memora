import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoTile } from '../../src/components/PhotoTile';
import { markAssets, setOne } from '../../src/db/actions';
import { STATUS } from '../../src/db/db';
import { markedIds } from '../../src/db/queries';
import { useDbQuery } from '../../src/library/useDbQuery';
import { PermissionGate } from '../../src/photos/PermissionGate';
import { usePhotos } from '../../src/photos/usePhotos';
import { colors, formatCount, space } from '../../src/theme';

const COLUMNS = 3;

/** Library: the familiar grid. Long-press to start selecting, then mark for deletion. */
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
  const { assets, loadMore } = usePhotos();
  const marked = useDbQuery(markedIds, []) ?? new Set<string>();

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onPress = (id: string) => {
    if (selecting) toggle(id);
    else if (marked.has(id)) void setOne(id, STATUS.marked, STATUS.todo); // tap a marked photo to unmark it
    // TODO: open a full-screen viewer
  };

  const onLongPress = (id: string) => {
    setSelecting(true);
    toggle(id);
  };

  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const markSelected = async () => {
    await markAssets(assets.filter((a) => selected.has(a.id)));
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
            <Text style={styles.count}>{formatCount(selected.size)} selected</Text>
            <Pressable onPress={markSelected} disabled={selected.size === 0} hitSlop={8}>
              <Text style={[styles.action, { fontWeight: '600', opacity: selected.size ? 1 : 0.4 }]}>Mark</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Library</Text>
            {marked.size > 0 && (
              <Pressable onPress={() => router.push('/review')} hitSlop={8}>
                <Text style={styles.action}>Review {formatCount(marked.size)}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      <FlashList
        data={assets}
        keyExtractor={(a) => a.id}
        numColumns={COLUMNS}
        extraData={{ selected, marked, selecting }}
        onEndReached={loadMore}
        onEndReachedThreshold={1.5}
        renderItem={({ item }) => (
          <PhotoTile
            id={item.id}
            uri={item.uri}
            size={width / COLUMNS}
            duration={item.mediaType === 'video' ? item.duration : undefined}
            marked={marked.has(item.id)}
            selected={selecting ? selected.has(item.id) : undefined}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        )}
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
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: colors.text },
  count: { fontSize: 16, fontWeight: '600', color: colors.text },
  action: { fontSize: 16, color: colors.text },
});
