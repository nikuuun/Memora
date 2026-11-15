import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
 * Controls follow Apple's guidance: 44pt touch targets, 16pt from the edges,
 * clear of the status bar / Dynamic Island and the home indicator.
 */
export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
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
  useEventListener(player, 'sourceLoad', (e) => setDuration(e.duration));
  useEventListener(player, 'statusChange', (e) => {
    if (e.status === 'readyToPlay') setLoading(false);
    if (e.status === 'error') {
      setLoading(false);
      setError(`This video couldn’t be played.${e.error?.message ? `\n${e.error.message}` : ''}`);
    }
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const info = await MediaLibrary.getAssetInfoAsync(id, { shouldDownloadFromNetwork: true });
        // iOS gives "ph://" ids, which video players can't open; localUri is the real file.
        const uri = info.localUri ?? (info.uri.startsWith('ph://') ? null : info.uri);
        if (!uri) throw new Error('No playable file for this video.');
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
      } catch (e) {
        if (alive) {
          setLoading(false);
          setError(`This video couldn’t be opened.${e instanceof Error ? `\n${e.message}` : ''}`);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, player]);

  const close = () => {
    player.pause();
    router.back();
  };

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
  const ready = !loading && !error;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* Video area: fills the space between the two control bars. */}
      <View style={{ flex: 1, marginTop: insets.top + 52 }}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
        <Pressable
          style={[StyleSheet.absoluteFill, styles.center]}
          onPress={togglePlay}
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          disabled={!ready}
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

      {/* Top bar sits below the status bar / Dynamic Island. */}
      <View style={[styles.top, { paddingTop: Math.max(insets.top, 20) + 4 }]}>
        <Pressable onPress={close} accessibilityLabel="Close video" style={styles.touch}>
          <View style={styles.roundBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </View>
        </Pressable>
        <Text style={styles.info} numberOfLines={1}>
          {[duration ? formatDuration(duration) : null, size].filter(Boolean).join(' · ')}
        </Text>
        <Pressable onPress={cycleSpeed} accessibilityLabel={`Playback speed ${speed}×`} style={styles.touch} disabled={!ready}>
          <View style={[styles.speed, !ready && { opacity: 0.4 }]}>
            <Text style={styles.speedText}>{speed}×</Text>
          </View>
        </Pressable>
      </View>

      {/* Bottom bar sits above the home indicator. */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <Pressable onPress={togglePlay} accessibilityLabel={playing ? 'Pause' : 'Play'} style={styles.touch} disabled={!ready}>
          <Ionicons name={playing ? 'pause' : 'play'} size={26} color="#fff" style={!ready && { opacity: 0.4 }} />
        </Pressable>
        <Text style={styles.time}>{formatDuration(current)}</Text>
        <Pressable
          style={styles.barHit}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width || 1)}
          onPress={(e) => seek(e.nativeEvent.locationX)}
          accessibilityLabel="Seek"
          disabled={!ready}
        >
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
          </View>
        </Pressable>
        <Text style={[styles.time, styles.timeRight]}>{formatDuration(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6, // + centred 44pt targets = icons ~16pt from the edge
  },
  touch: { minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, textAlign: 'center', color: '#BDBDB8', fontSize: 13 },
  speed: {
    minWidth: 44,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: { color: '#fff', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  center: { alignItems: 'center', justifyContent: 'center' },
  bigPlay: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#fff', fontSize: 15, lineHeight: 21, textAlign: 'center', paddingHorizontal: 32 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingTop: 10,
  },
  time: { width: 42, color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'] },
  timeRight: { textAlign: 'right', color: '#BDBDB8', marginRight: 10 },
  barHit: { flex: 1, height: 44, justifyContent: 'center' },
  bar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff' },
});
