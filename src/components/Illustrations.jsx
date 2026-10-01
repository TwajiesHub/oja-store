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
    <svg className="brand-hero__bus" viewBox="0 0 640 320" role="img" aria-label="Illustration of a yellow Lagos danfo bus">
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
