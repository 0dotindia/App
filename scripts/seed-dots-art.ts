// Generated SVG avatars/covers shared by the seed scripts (served from public/uploads).

export const PALETTES: [string, string][] = [
  ["#FF9933", "#E8590C"], ["#7048E8", "#3B5BDB"], ["#0CA678", "#1098AD"], ["#D6336C", "#AE3EC9"],
  ["#F59F00", "#E8590C"], ["#1971C2", "#0B7285"], ["#C2255C", "#862E9C"], ["#2F9E44", "#66A80F"],
  ["#5F3DC4", "#1864AB"], ["#E03131", "#F76707"], ["#0B7285", "#2F9E44"], ["#862E9C", "#D6336C"],
];

export function avatarSvg(initials: string, [c1, c2]: [string, string], variant: number): string {
  const shapes = [
    `<circle cx="205" cy="55" r="70" fill="#fff" opacity=".13"/><circle cx="40" cy="215" r="85" fill="#000" opacity=".10"/>`,
    `<circle cx="60" cy="50" r="60" fill="#fff" opacity=".15"/><circle cx="220" cy="210" r="75" fill="#fff" opacity=".10"/>`,
    `<rect x="120" y="-40" width="180" height="180" rx="50" transform="rotate(30 210 50)" fill="#fff" opacity=".12"/><circle cx="35" cy="225" r="70" fill="#000" opacity=".10"/>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="256" height="256" fill="url(#g)"/>${shapes[variant % shapes.length]}
<text x="128" y="128" text-anchor="middle" dominant-baseline="central" font-family="Inter, 'Segoe UI', system-ui, sans-serif" font-size="104" font-weight="600" fill="#fff" letter-spacing="-2">${initials}</text>
</svg>`;
}

export function coverSvg([c1, c2]: [string, string], variant: number): string {
  const waves = [
    `<path d="M0 380 C 300 300, 600 460, 900 380 S 1300 330, 1500 400 L1500 500 L0 500Z" fill="#fff" opacity=".10"/><path d="M0 430 C 350 360, 700 480, 1000 420 S 1350 390, 1500 440 L1500 500 L0 500Z" fill="#000" opacity=".10"/>`,
    `<circle cx="1250" cy="90" r="260" fill="#fff" opacity=".10"/><circle cx="180" cy="430" r="220" fill="#000" opacity=".10"/><circle cx="760" cy="60" r="120" fill="#fff" opacity=".08"/>`,
    `<path d="M0 0 L520 0 L260 500 L0 500Z" fill="#fff" opacity=".07"/><path d="M900 0 L1500 0 L1500 500 L640 500Z" fill="#000" opacity=".09"/><circle cx="1180" cy="150" r="140" fill="#fff" opacity=".10"/>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500" viewBox="0 0 1500 500" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="1500" height="500" fill="url(#g)"/>${waves[variant % waves.length]}
</svg>`;
}

// ---------- DM encryption (mirrors src/lib/message-crypto.ts, which is server-only) ----------
