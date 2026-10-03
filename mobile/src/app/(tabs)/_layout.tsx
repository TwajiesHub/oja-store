import { Tabs } from 'expo-router'

import { useBag } from '@/lib/bag'
import { colors, fonts } from '@/lib/theme'

// Text-only tabs, like the website's nav: no icon pack, the type does the work.
export default function TabsLayout() {
  const { count } = useBag()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.mute,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line, height: 64 },
        tabBarItemStyle: { justifyContent: 'center' },
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontFamily: fonts.monoMedium, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
        tabBarBadgeStyle: { backgroundColor: colors.ink, color: colors.paper, fontFamily: fonts.monoMedium },
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Shop' }} />
      <Tabs.Screen name="bag" options={{ title: 'Bag', tabBarBadge: count > 0 ? count : undefined }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  )
}
