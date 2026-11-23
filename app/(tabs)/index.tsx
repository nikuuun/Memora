import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReviewPill } from '../../src/components/ReviewPill';
import { Text, TextInput } from '../../src/components/Text';
import { scopeCounts } from '../../src/db/queries';
import { openPlayer } from '../../src/library/session';
import { useDbQuery } from '../../src/library/useDbQuery';
import { PermissionGate } from '../../src/photos/PermissionGate';
import { usePhotos } from '../../src/photos/usePhotos';
import { colors, eyebrowStyle, fonts, formatCount, formatDuration, radius, space } from '../../src/theme';

const RECENT = 9;
const GAP = 5;

/** Home, from the Figma design: a calm start page with recent photos and the two main jobs. */
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PermissionGate>
        <Home />
      </PermissionGate>
    </SafeAreaView>
  );
}

function Home() {
  const { width } = useWindowDimensions();
  const { assets } = usePhotos();
  const counts = useDbQuery(scopeCounts, []);
  const [prompt, setPrompt] = useState('');

  const recent = assets.slice(0, RECENT);
  const tile = (width - space.lg * 2 - GAP * 2) / 3;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const startStory = () => {
    router.push({ pathname: '/create', params: prompt.trim() ? { prompt: prompt.trim() } : {} });
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.top}>
        <Text style={styles.logo}>
          memora<Text style={styles.dot}>.</Text>
        </Text>
        {!!counts?.marked && <ReviewPill count={counts.marked} />}
      </View>

      <Text style={eyebrowStyle}>{today.toUpperCase()}</Text>
      <Text style={styles.headline}>
        Your memories,{'\n'}
        <Text style={styles.headlineEm}>beautifully told.</Text>
      </Text>
      <Text style={styles.intro}>
        Turn a camera roll full of moments into stories worth keeping, thoughtfully and simply.
      </Text>

      <View style={styles.studio}>
        <View style={styles.badge}>
          <Ionicons name="sparkles" size={12} color={colors.eyebrow} />
          <Text style={styles.badgeText}>STORY STUDIO</Text>
        </View>
        <Text style={styles.studioTitle}>
          What should this memory <Text style={styles.headlineEm}>feel like?</Text>
        </Text>
        <Text style={styles.studioBody}>Describe the mood. Pick a template and your photos, and shape them into a story.</Text>
        <View style={styles.promptBox}>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Dreamy, warm, a little nostalgic…"
            placeholderTextColor={colors.muted}
            style={styles.promptInput}
            returnKeyType="go"
            onSubmitEditing={startStory}
            accessibilityLabel="Describe your story"
          />
          <Pressable style={styles.promptBtn} onPress={startStory} accessibilityLabel="Start a story">
            <Ionicons name="arrow-forward" size={18} color={colors.card} />
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Recent moments</Text>
        <Pressable onPress={() => router.push('/photos')} hitSlop={8} style={styles.linkTouch}>
          <Text style={styles.link}>See all →</Text>
        </Pressable>
      </View>
      {recent.length ? (
        <View style={styles.grid}>
          {recent.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => (a.mediaType === 'video' ? openPlayer(a.id) : router.push('/photos'))}
              accessibilityLabel={a.mediaType === 'video' ? 'Play video' : 'See all photos'}
            >
              <Image source={{ uri: a.uri }} style={[styles.photo, { width: tile, height: tile }]} contentFit="cover" recyclingKey={a.id} />
              {a.mediaType === 'video' && (
                <View style={styles.duration}>
                  <Ionicons name="play" size={10} color="#fff" />
                  <Text style={styles.durationText}>{formatDuration(a.duration)}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="images-outline" size={26} color={colors.muted} />
          <Text style={styles.emptyText}>Your recent photos will appear here.</Text>
        </View>
      )}

      <Text style={[styles.section, styles.sectionAlone]}>Make room for more</Text>
      <Pressable style={styles.feature} onPress={() => router.push('/clean')}>
        <View style={styles.featureIcon}>
          <Ionicons name="sparkles-outline" size={24} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>A little photo refresh</Text>
          <Text style={styles.featureText}>
            {counts?.todo
              ? `${formatCount(counts.todo)} photos and videos to review. Keep favourites, mark the rest. Nothing is deleted until you confirm.`
              : 'Go through your photos, keep favourites, and review before anything is deleted.'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <Text style={styles.footer}>THE LITTLE THINGS ARE THE BIG THINGS.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: 40 },
  top: { height: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  logo: { fontFamily: fonts.serif, fontSize: 28, letterSpacing: -0.8, color: colors.text },
  dot: { fontFamily: fonts.serif, color: colors.accent },
  headline: { fontFamily: fonts.serif, fontSize: 38, lineHeight: 46, letterSpacing: -1, color: colors.text, marginTop: 12 },
  headlineEm: { fontFamily: fonts.serifItalic, color: colors.clay },
  intro: { fontSize: 15, lineHeight: 23, color: colors.muted, marginTop: 14, maxWidth: 330 },

  studio: { marginTop: 26, padding: 20, borderRadius: 16, backgroundColor: colors.studio },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeText: { ...eyebrowStyle, fontSize: 10 },
  studioTitle: { fontFamily: fonts.serif, fontSize: 25, lineHeight: 31, color: colors.text, marginTop: 10 },
  studioBody: { fontSize: 13, lineHeight: 19, color: '#5F5D55', marginTop: 8 },
  promptBox: {
    marginTop: 16,
    minHeight: 54,
    paddingLeft: 14,
    paddingRight: 5,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(73,66,54,0.12)',
    backgroundColor: '#F6F2E8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promptInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 12 },
  promptBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, marginBottom: 12 },
  section: { fontFamily: fonts.serif, fontSize: 23, color: colors.text },
  sectionAlone: { marginTop: 30, marginBottom: 12 },
  linkTouch: { height: 44, justifyContent: 'center' },
  link: { fontSize: 13, fontWeight: '600', color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  photo: { borderRadius: 6, backgroundColor: colors.surface },
  duration: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.overlay,
  },
  durationText: { color: '#fff', fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] },
  empty: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: { color: colors.muted, fontSize: 13 },

  feature: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  featureIcon: { backgroundColor: colors.surface, padding: 12, borderRadius: 12 },
  featureTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  featureText: { fontSize: 13, lineHeight: 19, color: colors.muted },
  footer: { ...eyebrowStyle, fontSize: 9, textAlign: 'center', marginTop: 40 },
});
