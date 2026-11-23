import * as MediaLibrary from 'expo-media-library/legacy';
import { useEffect, type ReactNode } from 'react';

import { Text } from '../components/Text';
import { startLibrarySync } from '../db/sync';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts, radius, space } from '../theme';

/**
 * Asks for photo access before showing its children.
 * iOS "Limited Access" only exposes the photos the user picked, which makes a
 * cleaner useless, so we show a banner asking for full access.
 */
export function PermissionGate({ children }: { children: ReactNode }) {
  const [perm, request] = MediaLibrary.usePermissions({
    granularPermissions: ['photo', 'video'],
  });

  if (!perm) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!perm.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Let Memora see your photos</Text>
        <Text style={styles.body}>
          Everything is sorted on your phone. Nothing is uploaded, and nothing is deleted until you
          confirm.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => (perm.canAskAgain ? request() : Linking.openSettings())}
        >
          <Text style={styles.buttonText}>{perm.canAskAgain ? 'Allow access' : 'Open Settings'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StartSync />
      {perm.accessPrivileges === 'limited' && (
        <Pressable style={styles.banner} onPress={() => Linking.openSettings()}>
          <Text style={styles.bannerText}>
            Memora can only see some of your photos. Tap to allow full access.
          </Text>
        </Pressable>
      )}
      {children}
    </View>
  );
}

/** Indexing starts as soon as we can see the photos. Safe to mount more than once. */
function StartSync() {
  useEffect(() => {
    startLibrarySync();
  }, []);
  return null;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  button: {
    marginTop: space.sm,
    backgroundColor: colors.text,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.lg,
  },
  buttonText: { color: colors.bg, fontWeight: '600', fontSize: 15 },
  banner: { backgroundColor: colors.surface, padding: space.md },
  bannerText: { color: colors.text, fontSize: 13, textAlign: 'center' },
});
