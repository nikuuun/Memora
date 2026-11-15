import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="grid" />
        <Stack.Screen name="deck" />
        {/* Plain pushed screens: reliable safe areas, back swipe works, and the
            player can open from Review without hiding behind it. */}
        <Stack.Screen name="review" />
        <Stack.Screen
          name="player"
          options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' }, fullScreenGestureEnabled: true }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
