import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../src/components/ScreenHeader';
import { Text } from '../src/components/Text';
import { cameraById } from '../src/digicam/look';
import { listShots } from '../src/digicam/shots';
import { useDbQuery } from '../src/library/useDbQuery';
import { colors, radius, space } from '../src/theme';

const COLUMNS = 3;

/** Every photo taken or developed with the Memora camera. Tap one to edit it. */
export default function RollScreen() {
  const { width } = useWindowDimensions();
  const shots = useDbQuery(() => listShots(), []);
  const tile = width / COLUMNS;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Memora photos"
        subtitle={shots ? `${shots.length} ${shots.length === 1 ? 'photo' : 'photos'}` : undefined}
      />
      {shots && !shots.length ? (
        <View style={styles.empty}>
          <Ionicons name="camera-outline" size={30} color={colors.muted} />
          <Text style={styles.emptyTitle}>No Memora photos yet</Text>
          <Text style={styles.emptyBody}>Photos you take with the Memora camera show up here. Tap one to edit its look.</Text>
          <Pressable style={styles.btn} onPress={() => router.navigate('/camera')}>
            <Text style={styles.btnText}>Open the camera</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={shots ?? []}
          numColumns={COLUMNS}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/shot/[id]', params: { id: item.id } })}
              accessibilityLabel={`${cameraById(item.develop.camera).name} photo, tap to edit`}
              style={{ width: tile, height: tile, padding: 1 }}
            >
              <Image source={{ uri: item.developedUri }} style={{ flex: 1 }} contentFit="cover" recyclingKey={item.developedUri} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 6 },
  emptyBody: { fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center', maxWidth: 300 },
  btn: { marginTop: 10, height: 46, paddingHorizontal: 22, borderRadius: radius.lg, backgroundColor: colors.text, justifyContent: 'center' },
  btnText: { color: colors.card, fontSize: 15, fontWeight: '600' },
});
