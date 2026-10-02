// Small illustrations drawn in code, used inside brand and edit blocks.

const BEADS = [
  [0, 6, 13], [42, 35, 10], [84, 59, 13], [126, 78, 10], [210, 104, 13], [252, 109, 10],
  [294, 110, 13], [336, 106, 10], [420, 84, 13], [462, 66, 10], [504, 43, 13], [546, 16, 10],
]
const BRASS_BARS = [[163, 83], [373, 87]]
const BEAD_HIGHLIGHTS = [[80, 55], [206, 100], [290, 106], [416, 80], [500, 39]]

export function CoralBeads() {
  return (
    <svg className="edit-tile__graphic edit-tile__graphic--beads" viewBox="0 0 560 128" aria-hidden="true">
      {BEADS.map(([cx, cy, r]) => <circle key={cx} cx={cx} cy={cy} r={r} fill="#C8452F" />)}
      {BRASS_BARS.map(([x, y]) => <rect key={x} x={x} y={y} width="10" height="20" rx="3" fill="#C9A24A" />)}
      {BEAD_HIGHLIGHTS.map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r="3.5" fill="#E27A5E" />)}
    </svg>
  )
}

export function SunHaze() {
  return (
    <svg className="edit-tile__graphic edit-tile__graphic--sun" viewBox="0 0 420 420" aria-hidden="true">
      <circle cx="210" cy="210" r="200" fill="#EBC486" />
      <circle cx="210" cy="210" r="150" fill="#F2D6A6" />
      <circle cx="210" cy="210" r="100" fill="#F7E6C6" />
    </svg>
  )
}

export function DanfoBus() {
  return (
    <svg className="brand-hero__art" viewBox="0 0 640 320" role="img" aria-label="Illustration of a yellow Lagos danfo bus">
      <ellipse cx="320" cy="292" rx="300" ry="10" fill="#111110" opacity="0.25" />
      <path d="M40 252 L40 112 Q40 78 74 78 L468 78 Q498 78 520 100 L592 172 Q606 186 606 206 L606 252 Z" fill="#F2B705" stroke="#111110" strokeWidth="5" />
      <rect x="58" y="50" width="170" height="30" fill="#111110" />
      <text x="143" y="71" textAnchor="middle" fill="#F2B705" fontFamily="JetBrains Mono, monospace" fontWeight="500" fontSize="16" letterSpacing="3">OSHODI</text>
      {[68, 152, 236, 320].map((x) => <rect key={x} x={x} y="98" width="72" height="62" rx="5" fill="#111110" />)}
      <rect x="404" y="98" width="62" height="62" rx="5" fill="#111110" />
      <path d="M480 98 L508 98 L570 162 L480 162 Z" fill="#111110" />
      <rect x="40" y="184" width="566" height="11" fill="#111110" />
      <rect x="40" y="204" width="566" height="11" fill="#111110" />
      <circle cx="592" cy="230" r="8" fill="#F4F1EA" stroke="#111110" strokeWidth="3" />
      <rect x="556" y="246" width="56" height="10" fill="#111110" />
      {[140, 498].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="256" r="36" fill="#111110" />
          <circle cx={cx} cy="256" r="14" fill="#8C877B" />
        </g>
      ))}
    </svg>
  )
}

// The wide version of the bead strand, stretched across an edit page hero.
export function CoralStrand() {
  return (
    <svg className="edit-hero__graphic edit-hero__graphic--beads" viewBox="0 0 560 128" preserveAspectRatio="none" aria-hidden="true">
      {BEADS.map(([cx, cy, r]) => <circle key={cx} cx={cx} cy={cy} r={r * 0.7} fill="#C8452F" />)}
      {BRASS_BARS.map(([x, y]) => <rect key={x} x={x + 2} y={y + 3} width="7" height="14" rx="2" fill="#C9A24A" />)}
    </svg>
  )
}

export function SunHazeWide() {
  return (
    <svg className="edit-hero__graphic edit-hero__graphic--sun" viewBox="0 0 420 420" aria-hidden="true">
      <circle cx="210" cy="210" r="200" fill="#EBC486" />
      <circle cx="210" cy="210" r="150" fill="#F2D6A6" />
      <circle cx="210" cy="210" r="100" fill="#F7E6C6" />
    </svg>
  )
}

// Elú: a length of hand-dyed adire cloth, with the resist-dyed rings and diamonds it is known for.
export function AdireCloth() {
  return (
    <svg className="brand-hero__art" viewBox="0 0 640 320" role="img" aria-label="Illustration of a length of indigo adire cloth">
      <defs>
        <pattern id="adire-motif" width="80" height="80" patternUnits="userSpaceOnUse">
          <circle cx="40" cy="40" r="26" fill="none" stroke="#F4EFE4" strokeWidth="3" />
          <circle cx="40" cy="40" r="15" fill="none" stroke="#F4EFE4" strokeWidth="3" />
          <circle cx="40" cy="40" r="5" fill="#F4EFE4" />
          <path d="M0 0 L8 8 M80 0 L72 8 M0 80 L8 72 M80 80 L72 72" stroke="#F4EFE4" strokeWidth="3" strokeLinecap="round" />
          <path d="M40 0 L46 6 L40 12 L34 6 Z M40 80 L46 74 L40 68 L34 74 Z" fill="#F4EFE4" />
        </pattern>
      </defs>
      <ellipse cx="320" cy="298" rx="270" ry="9" fill="#F4EFE4" opacity="0.18" />
      <path
        d="M44 44 Q182 18 320 44 T596 44 L596 262 Q458 288 320 262 T44 262 Z"
        fill="#2D4079"
        stroke="#F4EFE4"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M44 44 Q182 18 320 44 T596 44 L596 262 Q458 288 320 262 T44 262 Z"
        fill="url(#adire-motif)"
        opacity="0.9"
      />
      <path d="M200 38 Q212 150 196 268 M420 40 Q408 150 424 268" fill="none" stroke="#1E2B55" strokeWidth="14" opacity="0.35" strokeLinecap="round" />
    </svg>
  )
}

// Ivie: a strand of coral beads with brass clasps, above a pair of brass hoops with coral tips.
const STRAND = Array.from({ length: 17 }, (_, i) => {
  const x = 60 + i * 32.5
  return { x, y: 52 + ((x - 320) / 260) ** 2 * 120, r: i % 4 === 2 ? 13 : 10 }
})

export function CoralAndBrass() {
  return (
    <svg className="brand-hero__art" viewBox="0 0 640 320" role="img" aria-label="Illustration of a coral bead necklace and brass hoop earrings">
      {STRAND.map(({ x, y, r }) => (
        <g key={x}>
          <circle cx={x} cy={y} r={r} fill="#C8452F" />
          <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.28} fill="#E27A5E" />
        </g>
      ))}
      {[4, 12].map((i) => (
        <rect key={i} x={STRAND[i].x - 5} y={STRAND[i].y - 12} width="10" height="24" rx="3" fill="#C9A24A" transform={`rotate(${i === 4 ? -24 : 24} ${STRAND[i].x} ${STRAND[i].y})`} />
      ))}
      {[236, 404].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="236" r="44" fill="none" stroke="#C9A24A" strokeWidth="8" />
          <circle cx={cx} cy="236" r="44" fill="none" stroke="#E6C878" strokeWidth="2" strokeDasharray="6 18" opacity="0.8" />
          <circle cx={cx} cy="284" r="13" fill="#C8452F" />
          <circle cx={cx - 4} cy="280" r="4" fill="#E27A5E" />
        </g>
      ))}
    </svg>
  )
}

// kade: two jars of whipped shea butter, a large and a small, in the brand's amber and cream.
function SheaJar({ x, y, scale }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="150" cy="346" rx="118" ry="9" fill="#241A13" opacity="0.18" />
      <rect x="48" y="100" width="204" height="240" rx="26" fill="#9C5B1F" stroke="#241A13" strokeWidth="3" />
      <rect x="66" y="118" width="15" height="196" rx="7" fill="#C58A4A" />
      <rect x="48" y="172" width="204" height="108" fill="#F3EADB" stroke="#241A13" strokeWidth="3" />
      <text x="150" y="226" textAnchor="middle" fill="#241A13" fontFamily="Fraunces, serif" fontSize="40">kade</text>
      <text x="150" y="252" textAnchor="middle" fill="#241A13" fontFamily="JetBrains Mono, monospace" fontSize="11" letterSpacing="2">WHIPPED SHEA</text>
      <rect x="58" y="40" width="184" height="64" rx="10" fill="#F3EADB" stroke="#241A13" strokeWidth="3" />
    </g>
  )
}

export function SheaJars() {
  return (
    <svg className="brand-hero__art" viewBox="0 0 640 360" role="img" aria-label="Illustration of two jars of kade whipped shea butter">
      <SheaJar x={40} y={96} scale={0.64} />
      <SheaJar x={230} y={0} scale={1} />
    </svg>
  )
}
