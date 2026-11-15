import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkedBar, UndoToast } from '../../src/components/BottomBars';
import { Chip } from '../../src/components/Chip';
import { loadResults, loadTags, scopeCounts, type Group, type Scope, type Tag } from '../../src/db/queries';
import { openDeck, openGrid, reviewAgain } from '../../src/library/session';
import { useLibrary } from '../../src/library/store';
import { useDbQuery } from '../../src/library/useDbQuery';
import { PermissionGate } from '../../src/photos/PermissionGate';
import { colors, formatCount, items, radius, space } from '../../src/theme';

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
  const [scope, setScope] = useState<Scope>('todo');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const sync = useLibrary((s) => s.sync);

  const counts = useDbQuery(scopeCounts, []);
  const tags = useDbQuery(() => loadTags(scope), [scope]);
  const results = useDbQuery(
    () => (tags ? loadResults(scope, selected, tags) : Promise.resolve(undefined)),
    [scope, selected.join('|'), tags],
  );

  const pickScope = (next: Scope) => {
    setScope(next);
    setSelected([]);
    setQuery('');
  };
  const toggleTag = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
    setQuery('');
  };

  // Chosen keywords first, then everything matching what's typed.
  const q = query.trim().toLowerCase();
  const byId = new Map((tags ?? []).map((t) => [t.id, t]));
  const chosen: Tag[] = selected.map(
    (id) => byId.get(id) ?? { id, label: id.replace(/^\w+:/, ''), kind: 'type', count: 0 },
  );
  const others = (tags ?? []).filter((t) => !selected.includes(t.id) && (!q || t.label.toLowerCase().includes(q)));
  const visibleTags = [...chosen, ...others];

  const inTodo = scope === 'todo';
  const scopeTotal = counts ? (inTodo ? counts.todo : counts.reviewed) : undefined;
  const firstIndex = sync.running && sync.firstRun;

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.title}>Clean</Text>

      {firstIndex && (
        <View style={styles.indexCard}>
          <View style={styles.indexRow}>
            <Text style={styles.indexTitle}>Getting your library ready</Text>
            <Text style={styles.indexCount}>
              {formatCount(sync.done)} of {formatCount(sync.total)}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${sync.total ? Math.round((sync.done / sync.total) * 100) : 0}%` }]} />
          </View>
          <Text style={styles.indexHint}>First time only. You can start cleaning while this runs.</Text>
        </View>
      )}

      <View style={styles.segment}>
        <ScopeButton label="To review" count={counts?.todo} active={inTodo} onPress={() => pickScope('todo')} />
        <ScopeButton label="Reviewed" count={counts?.reviewed} active={!inTodo} onPress={() => pickScope('reviewed')} />
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={inTodo ? 'Search: screenshots, WhatsApp, 2023' : 'Search reviewed photos'}
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search keywords"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.tagRow}
        style={styles.tagScroll}
      >
        {visibleTags.map((t) => (
          <Chip key={t.id} label={t.label} count={t.count} active={selected.includes(t.id)} onPress={() => toggleTag(t.id)} />
        ))}
        {tags && visibleTags.length === 0 && <Text style={styles.noTags}>No keyword matches that search</Text>}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.results} keyboardShouldPersistTaps="handled">
        <View style={styles.headingRow}>
          <Text style={styles.heading}>
            {selected.length ? 'Groups' : inTodo ? 'Suggested groups' : 'Reviewed, by type'}
          </Text>
          {selected.length > 0 && (
            <Pressable onPress={() => setSelected([])} hitSlop={8}>
              <Text style={styles.link}>Clear keywords</Text>
            </Pressable>
          )}
        </View>

        {results?.match && results.match.count > 0 && (
          <View style={styles.matchCard}>
            <Text style={styles.matchCount}>{items(results.match.count)}</Text>
            <Text style={styles.matchSub}>match {results.match.label}</Text>
            <Actions
              inTodo={inTodo}
              onPrimary={() =>
                inTodo
                  ? openDeck(results.match!.filter, results.match!.label)
                  : reviewAgain(results.match!.filter)
              }
              onSecondary={() => openGrid(results.match!.filter, results.match!.label)}
            />
          </View>
        )}

        {results?.match && results.match.count === 0 && (
          <Text style={styles.empty}>Nothing here matches these keywords.</Text>
        )}

        {!selected.length && scopeTotal === 0 && !firstIndex && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>{inTodo ? 'All caught up' : 'Nothing reviewed yet'}</Text>
            <Text style={styles.empty}>
              {inTodo
                ? 'Every photo has been reviewed. New photos will show up here.'
                : 'Photos you keep while cleaning land here, so you never go over them twice.'}
            </Text>
          </View>
        )}

        {results?.groups.map((g) => (
          <GroupCard key={g.key} group={g} inTodo={inTodo} />
        ))}
      </ScrollView>

      <UndoToast />
      <MarkedBar />
    </View>
  );
}

function ScopeButton(props: { label: string; count?: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: props.active }}
      style={[styles.scopeBtn, props.active && styles.scopeBtnActive]}
    >
      <Text style={[styles.scopeText, props.active && { fontWeight: '600' }]}>
        {props.label} <Text style={styles.scopeCount}>{props.count != null ? formatCount(props.count) : ''}</Text>
      </Text>
    </Pressable>
  );
}

function Actions(props: { inTodo: boolean; onPrimary: () => void; onSecondary: () => void }) {
  return (
    <View style={styles.actions}>
      <Pressable style={[styles.btn, styles.btnLight]} onPress={props.onPrimary}>
        <Text style={styles.btnLightText}>{props.inTodo ? 'Review one by one' : 'Review again'}</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.btnDark]} onPress={props.onSecondary}>
        <Text style={styles.btnDarkText}>{props.inTodo ? 'Select all' : 'Pick to delete'}</Text>
      </Pressable>
    </View>
  );
}

const THUMBS = 6;

function GroupCard({ group, inTodo }: { group: Group; inTodo: boolean }) {
  const { width } = useWindowDimensions();
  // Card inner width = screen - 2 * 16 page padding - 2 * 13 card padding/border.
  const thumb = (width - 32 - 26 - (THUMBS - 1) * 3) / THUMBS;
  const name = `${group.title} · ${group.sub}`;
  const more = group.count - group.thumbs.length;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{group.title}</Text>
      <Text style={styles.cardSub}>
        {group.sub} · {items(group.count)}
      </Text>
      <View style={styles.thumbs}>
        {group.thumbs.map((t) => (
          <Image
            key={t.id}
            source={{ uri: t.uri }}
            style={{ width: thumb, height: thumb, borderRadius: 4, backgroundColor: colors.surface }}
            contentFit="cover"
            recyclingKey={t.id}
          />
        ))}
        {more > 0 && (
          <View style={[styles.more, { width: thumb, height: thumb }]}>
            <Text style={styles.moreText}>+{formatCount(more)}</Text>
          </View>
        )}
      </View>
      <Actions
        inTodo={inTodo}
        onPrimary={() => (inTodo ? openDeck(group.filter, name) : reviewAgain(group.filter))}
        onSecondary={() => openGrid(group.filter, name)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.text,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: 10,
  },
  indexCard: {
    marginHorizontal: space.lg,
    marginBottom: 10,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    gap: 6,
  },
  indexRow: { flexDirection: 'row', justifyContent: 'space-between' },
  indexTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  indexCount: { fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.text },
  indexHint: { fontSize: 12, color: colors.muted },
  segment: {
    marginHorizontal: space.lg,
    marginBottom: 10,
    padding: 3,
    gap: 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
  },
  scopeBtn: { flex: 1, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  scopeBtnActive: {
    backgroundColor: colors.bg,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  scopeText: { fontSize: 14, fontWeight: '500', color: colors.text },
  scopeCount: { fontWeight: '500', color: colors.muted },
  search: {
    marginHorizontal: space.lg,
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  tagScroll: { flexGrow: 0 },
  tagRow: { gap: 6, paddingHorizontal: space.lg, paddingTop: 10, paddingBottom: 4 },
  noTags: { fontSize: 13, color: colors.muted, lineHeight: 36 },
  results: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: 10 },
  headingRow: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  link: { fontSize: 14, color: colors.text, textDecorationLine: 'underline' },
  matchCard: { padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  matchCount: { fontSize: 15, fontWeight: '600', color: colors.text },
  matchSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  empty: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  emptyBox: { marginTop: 40, alignItems: 'center', gap: 6, paddingHorizontal: space.xl },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  card: { padding: space.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  cardSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  thumbs: { flexDirection: 'row', gap: 3, marginTop: 10 },
  more: { borderRadius: 4, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: 10 },
  btn: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnLight: { borderColor: colors.line, backgroundColor: colors.bg },
  btnDark: { borderColor: colors.text, backgroundColor: colors.text },
  btnLightText: { fontSize: 14, fontWeight: '600', color: colors.text },
  btnDarkText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
