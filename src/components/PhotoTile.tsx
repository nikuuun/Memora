import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../theme';

type Props = {
  id: string;
  uri: string;
  size: number;
  isVideo?: boolean;
  selected?: boolean;
  queued?: boolean;
  onPress?: (id: string) => void;
  onLongPress?: (id: string) => void;
};

export const PhotoTile = memo(function PhotoTile({
  id,
  uri,
  size,
  isVideo,
  selected,
  queued,
  onPress,
  onLongPress,
}: Props) {
  return (
    <Pressable
      onPress={() => onPress?.(id)}
      onLongPress={() => onLongPress?.(id)}
      delayLongPress={250}
      style={{ width: size, height: size, padding: 1 }}
    >
      <Image source={{ uri }} style={styles.img} contentFit="cover" recyclingKey={id} transition={100} />
      {isVideo && (
        <View style={styles.corner}>
          <Ionicons name="videocam" size={12} color="#fff" />
        </View>
      )}
      {queued && (
        <View style={styles.queued}>
          <Ionicons name="trash" size={20} color="#fff" />
        </View>
      )}
      {selected && (
        <View style={styles.check}>
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  img: { flex: 1, backgroundColor: colors.surface },
  corner: { position: 'absolute', left: 5, bottom: 5 },
  queued: {
    ...StyleSheet.absoluteFill,
    margin: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    ...StyleSheet.absoluteFill,
    margin: 1,
    borderWidth: 3,
    borderColor: colors.text,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: 4,
  },
});
