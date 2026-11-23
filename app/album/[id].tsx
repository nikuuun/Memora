import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../../src/components/Text';
import { Avatar, AvatarStack } from '../../src/shared/Avatars';
import { type Album, displayName, peopleCount, photoCount, useShared } from '../../src/shared/store';
import { colors, eyebrowStyle, fonts, radius, space } from '../../src/theme';

const COLUMNS = 3;

/** One shared album: who's in it, everyone's photos, and Add photos. */
export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const album = useShared((s) => s.albums.find((a) => a.id === id));
  const { width } = useWindowDimensions();

  if (!album) {
    return (
      <SafeAreaView style={[styles.safe, styles.missing]}>
        <Text style={styles.missingText}>This album isn’t available any more.</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Back to Shared</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const tile = width / COLUMNS;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} style={styles.barBtn} accessibilityLabel="Back" hitSlop={4}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/album/people', params: { id: album.id } })}
          style={styles.barPill}
          accessibilityLabel="People in this album"
        >
          <Ionicons name="person-add-outline" size={16} color={colors.text} />
          <Text style={styles.barPillText}>Invite</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        <FlashList
          data={album.photos}
          numColumns={COLUMNS}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={<Header album={album} />}
          renderItem={({ item }) => (
            <Pressable
              style={{ width: tile, height: tile, padding: 1 }}
              onPress={() => router.push({ pathname: '/album/photo', params: { id: album.id, photo: item.id } })}
              accessibilityLabel={`Photo added by ${displayName(album, item.addedBy)}. Open full screen`}
            >
              <Image source={{ uri: item.uri }} style={styles.photo} contentFit="cover" recyclingKey={item.id} transition={80} />
              <View style={styles.by}>
                <Avatar album={album} email={item.addedBy} size={20} />
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="images-outline" size={28} color={colors.muted} />
              <Text style={styles.emptyTitle}>No photos yet</Text>
              <Text style={styles.emptyText}>Be the first to add some. Everyone in the album will see them.</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

function Header({ album }: { album: Album }) {
  const cover = album.photos[0]?.uri;
  const since = new Date(album.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return (
    <View style={styles.header}>
      <View style={styles.hero}>
        {cover ? (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
        ) : (
          <Ionicons name="images-outline" size={32} color={colors.muted} />
        )}
      </View>
      <Text style={[eyebrowStyle, { marginTop: 18 }]}>SHARED ALBUM · SINCE {since.toUpperCase()}</Text>
      <Text style={styles.title}>{album.name}</Text>
      <Text style={styles.meta}>
        {photoCount(album.photos.length)} · {peopleCount(album.members.length)}
      </Text>

      <Pressable
        style={styles.people}
        onPress={() => router.push({ pathname: '/album/people', params: { id: album.id } })}
        accessibilityLabel={`${peopleCount(album.members.length)}. See who's in this album`}
      >
        <AvatarStack album={album} max={5} size={30} />
        <Text style={styles.peopleText}>Everyone here can add photos</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      <Pressable
        style={styles.addBtn}
        onPress={() => router.push({ pathname: '/album/add', params: { id: album.id } })}
      >
        <Ionicons name="add" size={20} color={colors.card} />
        <Text style={styles.addText}>Add photos</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  barBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  barPill: {
    height: 44,
    paddingHorizontal: 14,
    marginRight: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barPillText: { fontSize: 14, fontWeight: '600', color: colors.text },

  header: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  hero: {
    height: 220,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 40, letterSpacing: -0.6, color: colors.text, marginTop: 6 },
  meta: { fontSize: 14, color: colors.muted, marginTop: 2 },
  people: {
    marginTop: 16,
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  peopleText: { flex: 1, fontSize: 14, color: colors.text },
  addBtn: {
    marginTop: 12,
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addText: { color: colors.card, fontSize: 16, fontWeight: '600' },

  photo: { flex: 1, backgroundColor: colors.surface },
  by: { position: 'absolute', right: 6, bottom: 6, borderRadius: 12, borderWidth: 1.5, borderColor: '#fff' },

  empty: { alignItems: 'center', paddingHorizontal: space.xl, paddingTop: 30, gap: 8 },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.text },
  emptyText: { fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', maxWidth: 280 },

  missing: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  missingText: { fontSize: 15, color: colors.muted },
  secondaryBtn: { height: 44, paddingHorizontal: 18, justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '600', color: colors.text },
});
