import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, formatDuration } from '../theme';

type Props = {
  id: string;
  uri: string;
  size: number;
  /** Seconds; set for videos. */
  duration?: number;
  /** Dark overlay + check: chosen in a selection. */
  selected?: boolean;
  /** Empty circle: selectable but not chosen ("keeping" in the grid). */
  ring?: boolean;
  /** Small marked badge, used in the Library grid. */
  marked?: boolean;
  label?: string;
  onPress?: (id: string) => void;
  onLongPress?: (id: string) => void;
  /** Videos: shows a play button that opens the player. */
  onPlay?: (id: string) => void;
};

export const PhotoTile = memo(function PhotoTile({
  id,
  uri,
  size,
  duration,
  selected,
  ring,
  marked,
  label,
  onPress,
  onLongPress,
  onPlay,
}: Props) {
  return (
    <Pressable
      onPress={() => onPress?.(id)}
      onLongPress={onLongPress ? () => onLongPress(id) : undefined}
      delayLongPress={250}
      accessibilityLabel={label}
      accessibilityState={selected != null ? { selected } : undefined}
      style={{ width: size, height: size, padding: 1 }}
    >
      {/* Thumbnails are decoded at tile size, and cached on disk by expo-image. */}
      <Image source={{ uri }} style={styles.img} contentFit="cover" recyclingKey={id} transition={80} />
      {duration != null &&
        (onPlay ? (
          // Its own button, so playing never toggles the selection underneath.
          <Pressable
            onPress={() => onPlay(id)}
            accessibilityLabel={`Play video, ${formatDuration(duration)}`}
            style={styles.playTouch}
          >
            <View style={[styles.duration, styles.play]}>
              <Ionicons name="play" size={11} color="#fff" />
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.duration}>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        ))}
      {marked && !selected && (
        <View style={styles.markedBadge}>
          <Ionicons name="trash" size={12} color="#fff" />
        </View>
      )}
      {selected && (
        <View style={styles.dim}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={14} color={colors.text} />
          </View>
        </View>
      )}
      {ring && !selected && <View style={styles.ring} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  img: { flex: 1, backgroundColor: colors.surface },
  duration: {
    position: 'absolute',
    left: 6,
    top: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.overlay,
  },
  // 44pt touch area in the corner (Apple's minimum); the visible pill sits inside it.
  playTouch: { position: 'absolute', left: 0, top: 0, width: 64, height: 44 },
  play: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  markedBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    ...StyleSheet.absoluteFill,
    margin: 1,
    backgroundColor: colors.dim,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: 6,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
