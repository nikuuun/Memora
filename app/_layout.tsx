import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { PlayfairDisplay_500Medium_Italic, PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '../src/theme';

// Keep the splash up until the fonts are ready, so text never jumps fonts.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_500Medium_Italic,
  });
  // If a font fails to load, carry on with the system font rather than hang.
  const ready = loaded || !!error;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="grid" />
        <Stack.Screen name="deck" />
        {/* Plain pushed screens: reliable safe areas, back swipe works, and the
            player can open from Review without hiding behind it. */}
        <Stack.Screen name="review" />
        <Stack.Screen
          name="album/photo"
          options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' }, fullScreenGestureEnabled: false }}
        />
        <Stack.Screen
          name="player"
          options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' }, fullScreenGestureEnabled: true }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
