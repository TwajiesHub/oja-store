// Each brand brings its own colours and type pairing (the website's `kit-*` classes). Colours
// arrive as data; this maps the pairing to a font and the letter-spacing and case it needs.
import type { TextStyle } from 'react-native'

import type { BrandKitData } from './types'

type Kit = {
  fontFamily: string
  transform: TextStyle['textTransform']
  // Letter-spacing as a fraction of the font size.
  spacing: number
  chipSpacing: number
  chipSize: number
  // Wide letter-spacing makes a name much longer, so it is drawn smaller.
  heroScale: number
}

const KITS: Record<string, Kit> = {
  condensed: { fontFamily: 'BigShouldersDisplay_900Black', transform: 'uppercase', spacing: 0.04, chipSpacing: 0.08, chipSize: 14, heroScale: 1 },
  serif: { fontFamily: 'CormorantGaramond_500Medium', transform: 'none', spacing: 0, chipSpacing: 0.12, chipSize: 16, heroScale: 1 },
  'soft-serif': { fontFamily: 'Fraunces_400Regular', transform: 'lowercase', spacing: -0.03, chipSpacing: 0, chipSize: 15, heroScale: 1 },
  didone: { fontFamily: 'BodoniModa_400Regular', transform: 'uppercase', spacing: 0.3, chipSpacing: 0.3, chipSize: 12, heroScale: 0.62 },
  'display-serif': { fontFamily: 'DMSerifDisplay_400Regular', transform: 'none', spacing: 0, chipSpacing: 0, chipSize: 15, heroScale: 1 },
  grotesk: { fontFamily: 'SpaceGrotesk_600SemiBold', transform: 'lowercase', spacing: -0.02, chipSpacing: 0, chipSize: 14, heroScale: 1 },
}

const FALLBACK: Kit = { fontFamily: 'Archivo_700Bold', transform: 'none', spacing: 0, chipSpacing: 0, chipSize: 14, heroScale: 1 }

export function kitFor(pairing: string): Kit {
  return KITS[pairing] ?? FALLBACK
}

// The brand's name in its own type, at `size`.
export function kitText(pairing: string, size: number, spacing: 'name' | 'chip' = 'name'): TextStyle {
  const kit = kitFor(pairing)
  return {
    fontFamily: kit.fontFamily,
    textTransform: kit.transform,
    fontSize: size,
    letterSpacing: size * (spacing === 'chip' ? kit.chipSpacing : kit.spacing),
  }
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

// Light brand colours (like kade's cream) dissolve into the paper without a border.
export function isLightKit(kit: Pick<BrandKitData, 'accent'>): boolean {
  return contrastRatio(kit.accent, '#F4F1EA') < 1.3
}
