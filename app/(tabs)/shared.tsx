import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../../src/components/Text';
import { inExpoGo, signIn, useAuth } from '../../src/drive/auth';
import { Avatar, AvatarStack } from '../../src/shared/Avatars';
import {
  afterSignIn,
  afterSignOut,
  type Album,
  displayName,
  imageSource,
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
  const { albums, mode, loading, error, refresh } = useShared();
  const account = useAuth((s) => s.account);
  const [signingIn, setSigningIn] = useState(false);
  const activity = recentActivity(albums);
  const cardW = (width - space.lg * 2 - GAP) / 2;

  // Catch up with what others added whenever you come back to the tab.
  useFocusEffect(
    useCallback(() => {
      if (useShared.getState().mode === 'drive') void useShared.getState().refresh();
    }, []),
  );

  const connect = async () => {
    if (inExpoGo) {
      Alert.alert(
        'Needs the Memora app build',
        'Google sign-in can’t return to Expo Go. Install the Memora development build (made on a Mac) to share real albums. You can still try everything with the sample albums.',
      );
      return;
    }
    setSigningIn(true);
    try {
      if (await signIn()) await afterSignIn();
    } catch (e) {
      Alert.alert('Couldn’t sign in', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  const accountMenu = () =>
    Alert.alert(account?.name ?? 'Google account', `Signed in as ${account?.email}. Shared albums are folders in your Google Drive.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void afterSignOut() },
    ]);

  const newAlbum = () => router.push('/album/new');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          mode === 'drive' ? <RefreshControl refreshing={loading && albums.length > 0} onRefresh={refresh} /> : undefined
        }
      >
        <View style={styles.top}>
          <Text style={titleStyle}>Shared</Text>
          <View style={styles.topRight}>
            {account && (
              <Pressable onPress={accountMenu} style={styles.accountBtn} accessibilityLabel="Google account">
                {account.picture ? (
                  <Image source={{ uri: account.picture }} style={styles.accountPic} />
                ) : (
                  <Ionicons name="person-circle-outline" size={30} color={colors.text} />
                )}
              </Pressable>
            )}
            <Pressable style={styles.newBtn} onPress={newAlbum} accessibilityLabel="New shared album">
              <Ionicons name="add" size={18} color={colors.card} />
              <Text style={styles.newText}>New</Text>
            </Pressable>
          </View>
        </View>

        <Text style={eyebrowStyle}>
          {albums.length} SHARED {albums.length === 1 ? 'ALBUM' : 'ALBUMS'}
        </Text>
        <Text style={styles.headline}>
          Better memories, <Text style={styles.em}>together.</Text>
        </Text>
        <Text style={styles.intro}>Collect every angle from the people who were there.</Text>

        {mode === 'sample' && (
          <View style={styles.signIn}>
            <Text style={styles.signInTitle}>Share albums with friends</Text>
            <Text style={styles.signInText}>
              Sign in with Google. Each album is a folder in your Google Drive, and everyone you invite can add their
              photos. Until then, these are sample albums.
            </Text>
            <Pressable style={styles.googleBtn} onPress={connect} disabled={signingIn}>
              {signingIn ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color={colors.card} />
                  <Text style={styles.googleText}>Continue with Google</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {error && (
          <Pressable style={styles.error} onPress={refresh}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>
              {error} {mode === 'drive' ? 'Tap to try again.' : ''}
            </Text>
          </Pressable>
        )}

        {mode === 'drive' && loading && albums.length === 0 && (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.muted} />
            <Text style={styles.loadingText}>Loading your shared albums…</Text>
          </View>
        )}

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

        {!(mode === 'drive' && loading && albums.length === 0) && (
          <>
            <Text style={styles.section}>{mode === 'sample' ? 'Sample albums' : 'Your albums'}</Text>
            <View style={styles.grid}>
              {albums.map((album) => (
                <AlbumCard key={album.id} album={album} width={cardW} />
              ))}
              <Pressable style={[styles.newCard, { width: cardW, height: cardW * 1.25 }]} onPress={newAlbum}>
                <Ionicons name="add" size={26} color={colors.text} />
                <Text style={styles.newCardText}>New shared album</Text>
              </Pressable>
            </View>
            {mode === 'drive' && albums.length === 0 && (
              <Text style={styles.emptyText}>
                No shared albums yet. Make one and invite the people who were there. Albums friends share with you show
                up here too.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AlbumCard({ album, width }: { album: Album; width: number }) {
  const cover = album.photos[0];
  return (
    <Pressable
      style={{ width }}
      onPress={() => router.push(`/album/${album.id}`)}
      accessibilityLabel={`${album.name}, ${photoCount(album.photos.length)}, ${peopleCount(album.members.length)}`}
    >
      <View style={[styles.cover, { height: width * 1.25 }]}>
        {cover ? (
          <Image source={imageSource(cover)} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
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
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accountBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  accountPic: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface },
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

  signIn: { marginTop: 20, padding: space.lg, borderRadius: 16, backgroundColor: colors.studio },
  signInTitle: { fontFamily: fonts.serif, fontSize: 21, color: colors.text },
  signInText: { fontSize: 14, lineHeight: 20, color: '#5F5D55', marginTop: 6 },
  googleBtn: {
    marginTop: 14,
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleText: { color: colors.card, fontSize: 16, fontWeight: '600' },

  error: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.text },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  loadingText: { fontSize: 14, color: colors.muted },

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
  emptyText: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 16 },
});
