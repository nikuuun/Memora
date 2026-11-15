import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Asset } from 'expo-media-library/legacy';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '../../src/components/Chip';
import { SwipeCard, type SwipeDirection } from '../../src/components/SwipeCard';
import { PermissionGate } from '../../src/photos/PermissionGate';
import { fetchAll, recentYears, TYPE_OPTIONS, type PhotoFilter } from '../../src/photos/query';
import { usePhotos } from '../../src/photos/usePhotos';
import { toQueued, useTrash, useTrashCount } from '../../src/trash/store';
import { colors, space } from '../../src/theme';

export default function CleanScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PermissionGate>
        <Clean />
      </PermissionGate>
    </SafeAreaView>
  );
}

function Clean() {
  const [filter, setFilter] = useState<PhotoFilter>({ type: 'all', year: null });
  const { assets, loadMore, hasNext, isLoading } = usePhotos(filter);

  const queue = useTrash((s) => s.queue);
  const kept = useTrash((s) => s.kept);
  const trash = useTrash((s) => s.trash);
  const keep = useTrash((s) => s.keep);
  const undo = useTrash((s) => s.undo);
  const resetKept = useTrash((s) => s.resetKept);
  const canUndo = useTrash((s) => s.history.length > 0);
  const trashCount = useTrashCount();
  const [bulkProgress, setBulkProgress] = useState<number | null>(null);

  // The deck = photos for this filter that haven't been decided yet.
  const deck = useMemo(() => assets.filter((a) => !queue[a.id] && !kept[a.id]), [assets, queue, kept]);

  // Keep a few cards ready so swiping never waits on loading.
  useEffect(() => {
    if (deck.length < 8 && hasNext && !isLoading) loadMore();
  }, [deck.length, hasNext, isLoading, loadMore]);

  const onSwiped = useCallback(
    (asset: Asset, dir: SwipeDirection) => {
      if (dir === 'trash') trash([toQueued(asset)]);
      else keep(toQueued(asset));
    },
    [trash, keep],
  );

  const isFiltered = filter.type !== 'all' || filter.year != null;
  const filterLabel = [
    TYPE_OPTIONS.find((o) => o.value === filter.type)?.label,
    filter.year ?? null,
  ]
    .filter((x) => x && x !== 'All')
    .join(', ');

  const moveAllToTrash = () => {
    Alert.alert(
      `Move all ${filterLabel} to trash?`,
      "You'll still review them before anything is deleted.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move all',
          style: 'destructive',
          onPress: async () => {
            setBulkProgress(0);
            try {
              const all = await fetchAll(filter, setBulkProgress);
              trash(all.map(toQueued));
            } finally {
              setBulkProgress(null);
            }
          },
        },
      ],
    );
  };

  const top = deck.slice(0, 2).reverse(); // render the 2nd card underneath the 1st

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Clean</Text>
        <Pressable onPress={() => router.push('/review')} style={styles.reviewBtn} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.text} />
          <Text style={styles.reviewText}>{trashCount}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {TYPE_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            active={filter.type === o.value}
            onPress={() => setFilter((f) => ({ ...f, type: o.value }))}
          />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="Any year" active={filter.year == null} onPress={() => setFilter((f) => ({ ...f, year: null }))} />
        {recentYears().map((y) => (
          <Chip key={y} label={String(y)} active={filter.year === y} onPress={() => setFilter((f) => ({ ...f, year: y }))} />
        ))}
      </ScrollView>

      <View style={styles.deck}>
        {top.map((a) => (
          <SwipeCard key={a.id} asset={a} isTop={a.id === deck[0].id} onSwiped={onSwiped} />
        ))}
        {deck.length === 0 && (
          <View style={styles.empty}>
            {isLoading ? (
              <ActivityIndicator />
            ) : (
              <>
                <Text style={styles.emptyTitle}>All caught up</Text>
                <Text style={styles.emptyBody}>
                  {trashCount > 0 ? `${trashCount} waiting in trash for review.` : 'Nothing left in this filter.'}
                </Text>
                {Object.keys(kept).length > 0 && (
                  <Pressable onPress={resetKept}>
                    <Text style={styles.link}>Show kept photos again</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <RoundButton icon="arrow-undo" label="Undo" disabled={!canUndo} onPress={() => undo()} />
        <RoundButton
          icon="close"
          label="Delete"
          color={colors.danger}
          big
          disabled={!deck[0]}
          onPress={() => deck[0] && onSwiped(deck[0], 'trash')}
        />
        <RoundButton
          icon="heart"
          label="Keep"
          color={colors.keep}
          big
          disabled={!deck[0]}
          onPress={() => deck[0] && onSwiped(deck[0], 'keep')}
        />
        <RoundButton
          icon="layers-outline"
          label="All"
          disabled={!isFiltered || bulkProgress != null}
          onPress={moveAllToTrash}
        />
      </View>

      {bulkProgress != null && (
        <Text style={styles.progress}>Collecting {bulkProgress} items…</Text>
      )}
    </View>
  );
}

function RoundButton(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  big?: boolean;
  disabled?: boolean;
}) {
  const size = props.big ? 64 : 48;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityLabel={props.label}
      style={[styles.round, { width: size, height: size, opacity: props.disabled ? 0.35 : 1 }]}
    >
      <Ionicons name={props.icon} size={props.big ? 28 : 20} color={props.color ?? colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  reviewText: { fontSize: 14, fontWeight: '600', color: colors.text },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm },
  deck: { flex: 1, margin: space.lg, marginBottom: space.md },
  empty: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: colors.text },
  emptyBody: { fontSize: 14, color: colors.muted },
  link: { fontSize: 14, color: colors.text, textDecorationLine: 'underline', marginTop: space.sm },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingBottom: space.lg,
  },
  round: {
    borderRadius: 999,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { textAlign: 'center', color: colors.muted, fontSize: 13, paddingBottom: space.sm },
});
