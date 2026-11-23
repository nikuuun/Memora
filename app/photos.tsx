import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoTile } from '../src/components/PhotoTile';
import { ReviewPill } from '../src/components/ReviewPill';
import { Text } from '../src/components/Text';
import { markAssets, setOne } from '../src/db/actions';
import { STATUS } from '../src/db/db';
import { markedIds } from '../src/db/queries';
import { openPlayer } from '../src/library/session';
import { useDbQuery } from '../src/library/useDbQuery';
import { PermissionGate } from '../src/photos/PermissionGate';
import { usePhotos } from '../src/photos/usePhotos';
import { colors, formatCount, space, titleStyle } from '../src/theme';

const COLUMNS = 3;

/** All photos: the familiar grid, opened from Home's "See all". Long-press to start selecting, then mark for deletion. */
export default function PhotosScreen() {
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
            <View style={styles.titleRow}>
              <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Back" hitSlop={4}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              <Text style={styles.title}>All photos</Text>
            </View>
            {marked.size > 0 && <ReviewPill count={marked.size} />}
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
            onPlay={selecting ? undefined : openPlayer}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginLeft: -12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: titleStyle,
  count: { fontSize: 16, fontWeight: '600', color: colors.text },
  action: { fontSize: 16, color: colors.text },
});
