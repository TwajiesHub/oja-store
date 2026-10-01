// Brand and edit colours arrive as data. These helpers turn them into CSS variables
// and check that text stays readable on them.

export function kitStyle(kit) {
  return { '--kit-bg': kit.accent, '--kit-fg': kit.accent_text }
}

function channel(value) {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

export function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

// Light brand colours (like kade's cream) dissolve into the page without a border.
export function isLightKit(kit) {
  return contrastRatio(kit.accent, '#F4F1EA') < 1.3
}

// Of a brand's two colours, the one that reads better on `background`.
export function readableOn(background, kit) {
  return contrastRatio(kit.accent, background) >= contrastRatio(kit.accent_text, background)
    ? kit.accent
    : kit.accent_text
}
