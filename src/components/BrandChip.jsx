import { isLightKit, kitStyle } from '../lib/brandKit.js'

// A small label in the brand's own colours and font. Light kits (like kade's cream) are
// flipped so the chip stays visible on the stone placeholder.
export default function BrandChip({ brand }) {
  const kit = isLightKit(brand)
    ? { ...brand, accent: brand.accent_text, accent_text: brand.accent }
    : brand
  return (
    <span className={`brand-chip kit-${brand.type_pairing}`} style={kitStyle(kit)}>
      {brand.name}
    </span>
  )
}
