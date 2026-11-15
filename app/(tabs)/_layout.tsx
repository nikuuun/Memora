import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { colors } from '../../src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Library', tabBarIcon: icon('images-outline') }} />
      <Tabs.Screen name="clean" options={{ title: 'Clean', tabBarIcon: icon('sparkles-outline') }} />
      <Tabs.Screen name="camera" options={{ title: 'Camera', tabBarIcon: icon('camera-outline') }} />
      <Tabs.Screen name="create" options={{ title: 'Create', tabBarIcon: icon('albums-outline') }} />
    </Tabs>
  );
}
