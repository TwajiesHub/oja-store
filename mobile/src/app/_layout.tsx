import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_700Bold,
  Archivo_900Black,
} from '@expo-google-fonts/archivo'
import { BigShouldersDisplay_900Black } from '@expo-google-fonts/big-shoulders-display'
import { BodoniModa_400Regular } from '@expo-google-fonts/bodoni-moda'
import { CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond'
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display'
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces'
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono'
import { PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display'
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk'
import { useFonts } from 'expo-font'
import { SplashScreen, Stack } from 'expo-router'
import { useEffect } from 'react'

import { AuthProvider } from '@/lib/auth'
import { BagProvider } from '@/lib/bag'
import { colors, fonts } from '@/lib/theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  // One weight of each brand's typeface: just what its chip, tile and page need.
  const [loaded, error] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_700Bold,
    Archivo_900Black,
    PlayfairDisplay_400Regular_Italic,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    BigShouldersDisplay_900Black,
    CormorantGaramond_500Medium,
    Fraunces_400Regular,
    BodoniModa_400Regular,
    DMSerifDisplay_400Regular,
    SpaceGrotesk_600SemiBold,
  })

  // If a font fails to load the app still opens, with the system font.
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync()
  }, [loaded, error])

  if (!loaded && !error) return null

  return (
    <AuthProvider>
      <BagProvider>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.paper },
          headerStyle: { backgroundColor: colors.paper },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fonts.heading, fontSize: 17 },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen name="shop" options={{ title: 'Shop' }} />
        <Stack.Screen name="brand/[slug]" options={{ title: '' }} />
        <Stack.Screen name="product/[slug]" options={{ title: '' }} />
        <Stack.Screen name="edit/[slug]" options={{ title: '' }} />
      </Stack>
      </BagProvider>
    </AuthProvider>
  )
}
