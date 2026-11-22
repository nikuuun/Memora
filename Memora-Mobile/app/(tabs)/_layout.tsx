import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '../../src/theme';
type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: string; size: number }) => (
  <Ionicons name={name} color={color} size={size} />
);
export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.ink,
    tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface,
      borderTopColor: colors.line, height: 62, paddingBottom: 8, paddingTop: 5 },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline') }} />
    <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: icon('images-outline') }} />
    <Tabs.Screen name="clean" options={{ title: 'Clean', tabBarIcon: icon('sparkles-outline') }} />
    <Tabs.Screen name="camera" options={{ title: 'Camera', tabBarIcon: icon('camera-outline') }} />
    <Tabs.Screen name="create" options={{ title: 'Create', tabBarIcon: icon('albums-outline') }} />
  </Tabs>;
}
