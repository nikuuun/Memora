import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../../src/components/Text';
import { Avatar, AvatarStack } from '../../src/shared/Avatars';
import {
  type Album,
  displayName,
  peopleCount,
  photoCount,
  recentActivity,
  timeAgo,
  useShared,
} from '../../src/shared/store';
import { colors, eyebrowStyle, fonts, radius, space, titleStyle } from '../../src/theme';

const GAP = 12;

/** Shared albums, from linhant's "Shared" page: everyone who was there adds their photos. */
export default function SharedScreen() {
  const { width } = useWindowDimensions();
  const albums = useShared((s) => s.albums);
  const activity = recentActivity(albums);
  const cardW = (width - space.lg * 2 - GAP) / 2;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <Text style={titleStyle}>Shared</Text>
          <Pressable
            style={styles.newBtn}
            onPress={() => router.push('/album/new')}
            accessibilityLabel="New shared album"
          >
            <Ionicons name="add" size={18} color={colors.card} />
            <Text style={styles.newText}>New</Text>
          </Pressable>
        </View>

        <Text style={eyebrowStyle}>
          {albums.length} SHARED {albums.length === 1 ? 'ALBUM' : 'ALBUMS'}
        </Text>
        <Text style={styles.headline}>
          Better memories, <Text style={styles.em}>together.</Text>
        </Text>
        <Text style={styles.intro}>Collect every angle from the people who were there.</Text>

        <View style={styles.preview}>
          <Ionicons name="flask-outline" size={16} color={colors.eyebrow} />
          <Text style={styles.previewText}>
            Preview with sample albums. Google sign-in and real invites come next, so nothing here is sent yet.
          </Text>
        </View>

        {activity.length > 0 && (
          <>
            <Text style={styles.section}>Recent activity</Text>
            <View style={styles.activity}>
              {activity.map((a, i) => (
                <Pressable
                  key={a.key}
                  style={[styles.activityRow, i > 0 && styles.activityLine]}
                  onPress={() => router.push(`/album/${a.album.id}`)}
                >
                  <Avatar album={a.album} email={a.by} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>
                      {displayName(a.album, a.by)} added {photoCount(a.count)}
                    </Text>
                    <Text style={styles.activityMeta} numberOfLines={1}>
                      to {a.album.name} · {timeAgo(a.at)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.section}>Your albums</Text>
        <View style={styles.grid}>
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} width={cardW} />
          ))}
          <Pressable
            style={[styles.newCard, { width: cardW, height: cardW * 1.25 }]}
            onPress={() => router.push('/album/new')}
          >
            <Ionicons name="add" size={26} color={colors.text} />
            <Text style={styles.newCardText}>New shared album</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AlbumCard({ album, width }: { album: Album; width: number }) {
  const cover = album.photos[0]?.uri;
  return (
    <Pressable
      style={{ width }}
      onPress={() => router.push(`/album/${album.id}`)}
      accessibilityLabel={`${album.name}, ${photoCount(album.photos.length)}, ${peopleCount(album.members.length)}`}
    >
      <View style={[styles.cover, { height: width * 1.25 }]}>
        {cover ? (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
        ) : (
          <Ionicons name="images-outline" size={28} color={colors.muted} />
        )}
        <View style={styles.stack}>
          <AvatarStack album={album} size={24} />
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {album.name}
      </Text>
      <Text style={styles.cardMeta}>
        {photoCount(album.photos.length)} · {peopleCount(album.members.length)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: 40 },
  top: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  newBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  newText: { color: colors.card, fontSize: 14, fontWeight: '600' },
  headline: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 40, letterSpacing: -0.8, color: colors.text, marginTop: 10 },
  em: { fontFamily: fonts.serifItalic, color: colors.clay },
  intro: { fontSize: 15, lineHeight: 23, color: colors.muted, marginTop: 10 },

  preview: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  previewText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.text },

  section: { fontFamily: fonts.serif, fontSize: 23, color: colors.text, marginTop: 30, marginBottom: 12 },
  activity: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  activityRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  activityLine: { borderTopWidth: 1, borderTopColor: colors.line },
  activityTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  activityMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, rowGap: 20 },
  cover: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: { position: 'absolute', left: 8, bottom: 8 },
  cardTitle: { fontFamily: fonts.serif, fontSize: 17, color: colors.text, marginTop: 8 },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  newCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  newCardText: { fontSize: 14, fontWeight: '600', color: colors.text },
});
