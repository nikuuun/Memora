import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatDuration } from '../src/theme';

const SPEEDS = [1, 1.5, 2];
/** The chosen speed carries over to the next video you open. */
const prefs = { speed: 1 };

// The player is a native object we drive imperatively; keeping writes in
// plain functions keeps the React Compiler happy.
const setRate = (p: VideoPlayer, rate: number) => {
  p.playbackRate = rate;
  prefs.speed = rate;
};
const seekTo = (p: VideoPlayer, seconds: number) => {
  p.currentTime = seconds;
};
const setUpdateInterval = (p: VideoPlayer) => {
  p.timeUpdateEventInterval = 0.25;
};

function formatSize(bytes: number) {
  const mb = bytes / 1_000_000;
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.max(1, Math.round(mb))} MB`;
}

/**
 * Full-screen player. Only one video loads at a time, and only when you tap
 * play. iCloud-only videos download first (a spinner shows meanwhile).
 */
export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(prefs.speed);
  const [barWidth, setBarWidth] = useState(1);

  const player = useVideoPlayer(null, setUpdateInterval);

  useEventListener(player, 'playingChange', (e) => setPlaying(e.isPlaying));
  useEventListener(player, 'timeUpdate', (e) => setCurrent(e.currentTime));
  useEventListener(player, 'sourceLoad', (e) => {
    setDuration(e.duration);
    setLoading(false);
  });
  useEventListener(player, 'statusChange', (e) => {
    if (e.status === 'error') {
      setLoading(false);
      setError('This video couldn’t be played.');
    }
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const info = await MediaLibrary.getAssetInfoAsync(id, { shouldDownloadFromNetwork: true });
        const uri = info.localUri ?? info.uri;
        if (!alive) return;
        try {
          const bytes = new File(uri).size;
          if (bytes) setSize(formatSize(bytes));
        } catch {
          // Size is a nice-to-have; some sources don't expose it.
        }
        await player.replaceAsync({ uri });
        if (!alive) return;
        setRate(player, prefs.speed);
        player.play();
      } catch {
        if (alive) {
          setLoading(false);
          setError('This video couldn’t be opened.');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, player]);

  const togglePlay = () => {
    if (playing) return player.pause();
    if (duration && current >= duration - 0.2) seekTo(player, 0);
    player.play();
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setRate(player, next);
    setSpeed(next);
  };

  const seek = (x: number) => {
    if (!duration) return;
    const t = Math.min(duration, Math.max(0, (x / barWidth) * duration));
    seekTo(player, t);
    setCurrent(t);
  };

  const progress = duration ? Math.min(1, current / duration) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close video" style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        <Text style={styles.info}>
          {[duration ? formatDuration(duration) : null, size].filter(Boolean).join(' · ')}
        </Text>
        <Pressable onPress={cycleSpeed} accessibilityLabel={`Playback speed ${speed}×`} style={styles.iconBtn} hitSlop={8}>
          <View style={styles.speed}>
            <Text style={styles.speedText}>{speed}×</Text>
          </View>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
        <Pressable
          style={[StyleSheet.absoluteFill, styles.center]}
          onPress={togglePlay}
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          disabled={loading || !!error}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : !playing ? (
            <View style={styles.bigPlay}>
              <Ionicons name="play" size={30} color="#fff" style={{ marginLeft: 3 }} />
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.bottom}>
        <Pressable onPress={togglePlay} accessibilityLabel={playing ? 'Pause' : 'Play'} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name={playing ? 'pause' : 'play'} size={24} color="#fff" />
        </Pressable>
        <Text style={styles.time}>{formatDuration(current)}</Text>
        <Pressable
          style={styles.barHit}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width || 1)}
          onPress={(e) => seek(e.nativeEvent.locationX)}
          accessibilityLabel="Seek"
        >
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
          </View>
        </Pressable>
        <Text style={[styles.time, { textAlign: 'right', color: '#BDBDB8' }]}>{formatDuration(duration)}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  iconBtn: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  info: { color: '#BDBDB8', fontSize: 13 },
  speed: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  speedText: { color: '#fff', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  center: { alignItems: 'center', justifyContent: 'center' },
  bigPlay: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#fff', fontSize: 15 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 10 },
  time: { width: 40, color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'] },
  barHit: { flex: 1, height: 32, justifyContent: 'center' },
  bar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff' },
});
