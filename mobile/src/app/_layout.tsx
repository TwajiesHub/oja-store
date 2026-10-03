import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_700Bold,
  Archivo_900Black,
} from '@expo-google-fonts/archivo'
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono'
import { PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display'
import { useFonts } from 'expo-font'
import { SplashScreen, Stack } from 'expo-router'
import { useEffect } from 'react'

import { AuthProvider } from '@/lib/auth'
import { colors } from '@/lib/theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_700Bold,
    Archivo_900Black,
    PlayfairDisplay_400Regular_Italic,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  })

  // If a font fails to load the app still opens, with the system font.
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync()
  }, [loaded, error])

  if (!loaded && !error) return null

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />
    </AuthProvider>
  )
}
