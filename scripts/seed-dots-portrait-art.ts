// Illustrated portrait avatars and role-themed covers for the seeded dots (served from public/uploads).
// Deterministic: the same (gender, seed) always gives the same face, so reruns don't shuffle people.
// Portraits are drawn in a 256x256 box; the viewBox zooms in so the face fills the circle profile avatars are shown in.

import type { RoleKey } from "./seed-dots-data";

type Rng = () => number;

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: Rng, a: readonly T[]): T => a[Math.floor(r() * a.length)];

// f < 0 darkens, f > 0 lightens
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Skin tones across the Indian range, wheatish to deep brown.
const SKIN = ["#F3D2B3", "#EBC29A", "#E2B187", "#D69E6E", "#C68A5A", "#B4744A", "#9A5E38"] as const;
const HAIR = ["#17110E", "#1E1511", "#2A1B14", "#3B261A"] as const;
const BG: readonly [string, string][] = [
  ["#FFE8CC", "#FFC078"], ["#E5DBFF", "#B197FC"], ["#D3F9D8", "#8CE99A"], ["#D0EBFF", "#74C0FC"],
  ["#FFDEEB", "#F783AC"], ["#FFF3BF", "#FFD43B"], ["#C5F6FA", "#66D9E8"], ["#E9ECEF", "#ADB5BD"],
];
const MALE_CLOTHES = ["#1F3A5F", "#2B2D42", "#5C2A3E", "#264653", "#3D405B", "#6B705C", "#8D5A2B", "#B08D57", "#E9DFCB", "#4A6572"] as const;
const FEMALE_CLOTHES = ["#C2255C", "#7048E8", "#0CA678", "#E8590C", "#1971C2", "#AE3EC9", "#F59F00", "#D6336C", "#2F9E44", "#0B7285"] as const;
const LIPS = ["#B5495B", "#A82A3A", "#C9605E", "#8F3552"] as const;

export type Gender = "m" | "f";

export function portraitSvg(gender: Gender, seed: number): string {
  const r = mulberry32(seed * 7919 + (gender === "m" ? 11 : 29));
  const skin = pick(r, SKIN);
  const skinShade = shade(skin, -0.18);
  const hair = pick(r, HAIR);
  const [bg1, bg2] = pick(r, BG);
  const female = gender === "f";
  const clothes = pick(r, female ? FEMALE_CLOTHES : MALE_CLOTHES);
  const iris = "#2B1B12";
  const out: string[] = [];

  // background
  out.push(`<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>`);
  out.push(`<rect width="256" height="256" fill="url(#bg)"/><circle cx="128" cy="120" r="104" fill="#fff" opacity=".28"/>`);

  // long hair sits behind the shoulders
  const femaleStyle = female ? Math.floor(r() * 5) : 0; // 0 long straight, 1 long over shoulders, 2 bun, 3 bob, 4 side braid
  if (female && (femaleStyle === 0 || femaleStyle === 1 || femaleStyle === 4)) {
    out.push(`<path d="M70 112 C64 36 192 36 186 112 L194 236 C160 250 96 250 62 236Z" fill="${hair}"/>`);
  }
  if (female && femaleStyle === 3) {
    out.push(`<path d="M70 106 C64 40 192 40 186 106 L188 168 C176 180 80 180 68 168Z" fill="${hair}"/>`);
  }

  // body
  const bodyPath = "M14 256 C18 212 60 194 106 188 L150 188 C196 194 238 212 242 256Z";
  const necklineRound = `<path d="M106 188 C110 210 146 210 150 188Z" fill="${skinShade}"/>`;
  const necklineV = `<path d="M108 188 L128 226 L148 188Z" fill="${skinShade}"/>`;
  // neck (drawn before clothes so the neckline shows skin)
  out.push(`<path d="M110 140 L110 190 C110 204 146 204 146 190 L146 140Z" fill="${skin}"/>`);
  out.push(`<path d="M110 166 C120 184 136 184 146 166 L146 192 L110 192Z" fill="${skinShade}" opacity=".55"/>`);

  if (!female) {
    const style = Math.floor(r() * 3); // 0 blazer over shirt, 1 kurta, 2 polo
    const shirt = pick(r, ["#F8F9FA", "#DCE9F7", "#F3EDE2"] as const);
    if (style === 0) {
      out.push(`<path d="${bodyPath}" fill="${clothes}"/>`);
      out.push(`<path d="M100 190 L128 256 L156 190Z" fill="${shirt}"/>`);
      out.push(`<path d="M108 188 L128 224 L148 188Z" fill="${skinShade}"/>`);
      out.push(`<path d="M104 186 L128 226 L100 218 L94 198Z" fill="${shirt}" stroke="${shade(shirt, -0.15)}" stroke-width="1.5"/>`);
      out.push(`<path d="M152 186 L128 226 L156 218 L162 198Z" fill="${shirt}" stroke="${shade(shirt, -0.15)}" stroke-width="1.5"/>`);
      out.push(`<path d="M94 198 L128 256 L84 256 C76 232 82 212 94 198Z" fill="${shade(clothes, 0.12)}"/>`);
      out.push(`<path d="M162 198 L128 256 L172 256 C180 232 174 212 162 198Z" fill="${shade(clothes, 0.12)}"/>`);
    } else if (style === 1) {
      out.push(`<path d="${bodyPath}" fill="${clothes}"/>`);
      out.push(`<path d="M106 188 C110 204 146 204 150 188Z" fill="${skinShade}"/>`);
      out.push(`<path d="M104 190 C108 208 148 208 152 190 L152 196 C148 214 108 214 104 196Z" fill="${shade(clothes, -0.18)}"/>`);
      out.push(`<path d="M128 208 L128 256" stroke="${shade(clothes, -0.25)}" stroke-width="2.5"/>`);
      for (const y of [222, 238]) out.push(`<circle cx="128" cy="${y}" r="2.6" fill="${shade(clothes, 0.35)}"/>`);
    } else {
      out.push(`<path d="${bodyPath}" fill="${clothes}"/>`);
      out.push(necklineRound);
      out.push(`<path d="M104 190 C108 212 148 212 152 190 L158 196 C152 222 104 222 98 196Z" fill="${shade(clothes, -0.14)}"/>`);
    }
  } else {
    const style = Math.floor(r() * 3); // 0 kurti, 1 saree, 2 top
    const trim = "#F2C14E";
    out.push(`<path d="${bodyPath}" fill="${clothes}"/>`);
    if (style === 0) {
      out.push(necklineRound);
      out.push(`<path d="M104 190 C108 214 148 214 152 190" fill="none" stroke="${trim}" stroke-width="3"/>`);
      for (let i = 0; i < 5; i++) out.push(`<circle cx="${112 + i * 8}" cy="${218 + Math.sin(i * 1.3) * 2}" r="1.8" fill="${trim}"/>`);
    } else if (style === 1) {
      const pallu = pick(r, FEMALE_CLOTHES.filter((c) => c !== clothes));
      out.push(`<path d="M106 188 C110 208 146 208 150 188Z" fill="${skinShade}"/>`);
      out.push(`<path d="M146 190 L242 226 L242 256 L118 256 C150 236 156 214 146 190Z" fill="${pallu}"/>`);
      out.push(`<path d="M146 190 C156 214 150 236 118 256" fill="none" stroke="${trim}" stroke-width="4"/>`);
      out.push(`<path d="M172 214 L242 240" stroke="${trim}" stroke-width="2" opacity=".8"/>`);
    } else {
      out.push(necklineV);
      out.push(`<path d="M102 188 L128 230 L108 232 L92 200Z" fill="${shade(clothes, -0.16)}"/>`);
      out.push(`<path d="M154 188 L128 230 L148 232 L164 200Z" fill="${shade(clothes, -0.16)}"/>`);
    }
    if (femaleStyle === 1) {
      // front locks over both shoulders
      out.push(`<path d="M80 120 C66 160 62 204 72 244 C90 250 102 244 102 238 C92 204 92 164 98 132Z" fill="${hair}"/>`);
      out.push(`<path d="M176 120 C190 160 194 204 184 244 C166 250 154 244 154 238 C164 204 164 164 158 132Z" fill="${hair}"/>`);
    }
    if (femaleStyle === 4) {
      for (let i = 0; i < 7; i++) {
        out.push(`<ellipse cx="${170 + i * 1.6}" cy="${140 + i * 15}" rx="${11 - i * 0.6}" ry="9" fill="${i % 2 ? shade(hair, 0.06) : hair}"/>`);
      }
    }
  }

  // ears
  out.push(`<ellipse cx="82" cy="114" rx="7" ry="12" fill="${skin}"/><ellipse cx="174" cy="114" rx="7" ry="12" fill="${skin}"/>`);
  out.push(`<ellipse cx="83" cy="115" rx="3" ry="6" fill="${skinShade}" opacity=".5"/><ellipse cx="173" cy="115" rx="3" ry="6" fill="${skinShade}" opacity=".5"/>`);

  // face
  const jaw = female ? 168 : 171;
  out.push(`<path d="M81 106 C81 68 103 56 128 56 C153 56 175 68 175 106 C175 ${female ? 138 : 142} ${female ? 154 : 158} ${jaw} 128 ${jaw} C${female ? 102 : 98} ${jaw} 81 ${female ? 138 : 142} 81 106Z" fill="${skin}"/>`);
  out.push(`<ellipse cx="116" cy="94" rx="30" ry="24" fill="#fff" opacity=".07"/>`);
  out.push(`<path d="M84 128 C90 154 108 170 128 170 C148 170 166 154 172 128 C164 152 148 162 128 162 C108 162 92 152 84 128Z" fill="${skinShade}" opacity=".18"/>`);

  // beard (men): full, stubble, moustache-only or clean
  const beard = female ? "none" : pick(r, ["full", "full", "stubble", "stubble", "moustache", "none", "none"] as const);
  if (beard === "full") {
    out.push(`<path d="M81 110 C80 152 102 178 128 178 C154 178 176 152 175 110 C172 128 164 138 152 142 L104 142 C92 138 84 128 81 110Z" fill="${hair}"/>`);
  } else if (beard === "stubble") {
    out.push(`<path d="M82 118 C84 156 104 174 128 174 C152 174 172 156 174 118 C170 136 160 146 150 148 L106 148 C96 146 86 136 82 118Z" fill="${hair}" opacity=".3"/>`);
  }
  if (beard === "full" || beard === "moustache") {
    out.push(`<path d="M106 143 C114 137 124 140 128 142 C132 140 142 137 150 143 C144 149 134 146 128 146 C122 146 112 149 106 143Z" fill="${hair}"/>`);
  }

  // eyes
  const ry = female ? 5.6 : 5;
  for (const cx of [108, 148]) {
    out.push(`<ellipse cx="${cx}" cy="113" rx="9.5" ry="${ry}" fill="#fff"/>`);
    out.push(`<circle cx="${cx}" cy="113" r="4" fill="${iris}"/><circle cx="${cx + 1.4}" cy="111.6" r="1.2" fill="#fff"/>`);
    out.push(`<path d="M${cx - 10} 113 Q${cx} ${female ? 105 : 106} ${cx + 10} 113" fill="none" stroke="#1A100C" stroke-width="${female ? 2.4 : 2}" stroke-linecap="round"/>`);
    if (female) out.push(`<path d="M${cx - 9} 115 Q${cx} 119 ${cx + 9} 115" fill="none" stroke="#1A100C" stroke-width="1.4" opacity=".7"/>`);
  }
  // brows
  const bw = female ? 3 : 4.6;
  out.push(`<path d="M96 101 Q108 ${female ? 92 : 95} 121 99" fill="none" stroke="${hair}" stroke-width="${bw}" stroke-linecap="round"/>`);
  out.push(`<path d="M135 99 Q148 ${female ? 92 : 95} 160 101" fill="none" stroke="${hair}" stroke-width="${bw}" stroke-linecap="round"/>`);
  // nose
  out.push(`<path d="M126 116 C123 128 121 132 126 135 C129 136 133 135 134 132" fill="none" stroke="${skinShade}" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>`);
  // cheeks
  out.push(`<circle cx="98" cy="132" r="10" fill="#E86A6A" opacity="${female ? 0.2 : 0.09}"/><circle cx="158" cy="132" r="10" fill="#E86A6A" opacity="${female ? 0.2 : 0.09}"/>`);
  // mouth
  if (female) {
    const lip = pick(r, LIPS);
    out.push(`<path d="M113 148 Q120 143 128 146 Q136 143 143 148 Q128 160 113 148Z" fill="${lip}"/>`);
    out.push(`<path d="M116 149 Q128 153 140 149" fill="none" stroke="${shade(lip, -0.3)}" stroke-width="1.2" opacity=".6"/>`);
  } else if (r() < 0.55) {
    out.push(`<path d="M115 150 Q128 162 141 150 Q128 154 115 150Z" fill="#fff"/><path d="M115 150 Q128 162 141 150" fill="none" stroke="#8A3F32" stroke-width="2.4" stroke-linecap="round"/>`);
  } else {
    out.push(`<path d="M116 151 Q128 159 140 151" fill="none" stroke="#8A3F32" stroke-width="2.6" stroke-linecap="round"/>`);
  }

  // front hair
  if (!female) {
    const style = Math.floor(r() * 4);
    const front = [
      "M78 102 C72 52 104 38 128 38 C152 38 184 52 178 102 C174 86 168 74 152 68 C138 64 118 64 104 68 C88 74 82 86 78 102Z",
      "M77 104 C66 48 108 26 138 32 C170 36 184 62 179 104 C176 86 168 72 150 66 C132 62 108 66 96 74 C84 82 80 94 77 104Z",
      "M74 114 C62 48 104 28 130 30 C168 30 190 56 182 114 C180 94 172 76 150 68 C130 62 106 66 94 76 C84 86 78 100 74 114Z",
      "M80 100 C76 60 104 46 128 46 C152 46 180 60 176 100 C172 86 166 78 128 76 C90 78 84 86 80 100Z",
    ][style];
    out.push(`<path d="${front}" fill="${hair}"/>`);
    if (style === 1) out.push(`<path d="M104 40 C112 54 108 62 100 68" fill="none" stroke="${shade(hair, 0.18)}" stroke-width="2" opacity=".7"/>`);
    out.push(`<path d="M96 48 C112 42 140 42 156 50" fill="none" stroke="#fff" stroke-width="3" opacity=".08" stroke-linecap="round"/>`);
  } else {
    if (femaleStyle === 2) {
      out.push(`<circle cx="128" cy="34" r="21" fill="${hair}"/><circle cx="123" cy="29" r="9" fill="#fff" opacity=".06"/>`);
      out.push(`<path d="M128 60 C102 62 86 80 80 108 C72 58 100 42 128 42 C156 42 184 58 176 108 C170 80 154 62 128 60Z" fill="${hair}"/>`);
    } else {
      out.push(`<path d="M128 60 C100 62 84 80 80 112 L76 132 C64 56 100 38 128 38 C156 38 192 56 180 132 L176 112 C172 80 156 62 128 60Z" fill="${hair}"/>`);
      out.push(`<path d="M128 40 C122 48 122 56 128 62" fill="none" stroke="${shade(hair, 0.2)}" stroke-width="1.6" opacity=".6"/>`);
    }
  }

  // glasses
  if (r() < (female ? 0.25 : 0.35)) {
    const frame = pick(r, ["#1A1A1A", "#5C3B24", "#B08D57"] as const);
    out.push(`<g fill="#fff" fill-opacity=".1" stroke="${frame}" stroke-width="2.6"><circle cx="108" cy="113" r="15"/><circle cx="148" cy="113" r="15"/></g>`);
    out.push(`<path d="M123 111 Q128 107 133 111 M93 111 L83 108 M163 111 L173 108" fill="none" stroke="${frame}" stroke-width="2.4" stroke-linecap="round"/>`);
  }

  // jewellery and marks
  if (female) {
    out.push(`<circle cx="128" cy="86" r="3.4" fill="${pick(r, ["#C1121F", "#7B1E2B", "#B5179E"] as const)}"/>`);
    for (const x of [81, 175]) {
      out.push(`<circle cx="${x}" cy="128" r="3.6" fill="#F2C14E"/><path d="M${x - 3.6} 131 L${x + 3.6} 131 L${x} 143Z" fill="#F2C14E"/><circle cx="${x}" cy="145" r="2" fill="#E8A317"/>`);
    }
    if (r() < 0.6) out.push(`<circle cx="119" cy="131" r="1.7" fill="#F2C14E"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="26 22 204 204">${out.join("")}</svg>`;
}

// ---------- covers ----------

const COVER_PALETTES: [string, string][] = [
  ["#0B3C5D", "#328CC1"], ["#3A0CA3", "#7209B7"], ["#7F1D1D", "#F97316"], ["#064E3B", "#10B981"],
  ["#1E3A8A", "#06B6D4"], ["#831843", "#F472B6"], ["#78350F", "#F59E0B"], ["#312E81", "#8B5CF6"],
  ["#134E4A", "#2DD4BF"], ["#4C1D95", "#EC4899"], ["#9A3412", "#FBBF24"], ["#1F2937", "#6366F1"],
];

type Motif = "hex" | "rangoli" | "skyline" | "mountains" | "waves" | "mandala";
const MOTIF_BY_ROLE: Record<RoleKey, Motif> = {
  swe: "hex", data: "hex", design: "rangoli", art: "rangoli", food: "rangoli",
  pm: "skyline", founder: "skyline", finance: "skyline", marketing: "skyline",
  photo: "mountains", sports: "mountains", fitness: "mountains",
  writer: "waves", music: "waves", film: "waves",
  doctor: "mandala", teacher: "mandala", student: "mandala",
};

function mandala(cx: number, cy: number, radius: number, petals: number): string {
  const parts: string[] = [];
  for (let ring = 0; ring < 3; ring++) {
    const rr = radius * (1 - ring * 0.26);
    for (let i = 0; i < petals; i++) {
      const a = (360 / petals) * i + ring * (180 / petals);
      parts.push(`<ellipse cx="${cx}" cy="${cy - rr * 0.55}" rx="${rr * 0.17}" ry="${rr * 0.42}" transform="rotate(${a} ${cx} ${cy})" fill="none" stroke="#fff" stroke-width="2" opacity="${0.5 - ring * 0.1}"/>`);
    }
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="#fff" stroke-width="1.5" opacity="${0.35 - ring * 0.06}"/>`);
  }
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius * 0.12}" fill="#fff" opacity=".55"/>`);
  return parts.join("");
}

function motifArt(motif: Motif, r: Rng): string {
  const o: string[] = [];
  if (motif === "mandala") {
    o.push(mandala(1180, 250, 210, 12), mandala(300, 250, 120, 8), mandala(720, 250, 60, 8));
  } else if (motif === "hex") {
    const s = 34;
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 34; col++) {
        const x = col * s * 1.5 + 20;
        const y = row * s * 1.732 + (col % 2 ? s * 0.866 : 0) - 20;
        if (r() < 0.14) o.push(`<polygon points="${[0, 1, 2, 3, 4, 5].map((k) => `${(x + s * 0.9 * Math.cos((Math.PI / 3) * k)).toFixed(1)},${(y + s * 0.9 * Math.sin((Math.PI / 3) * k)).toFixed(1)}`).join(" ")}" fill="#fff" opacity="${(0.05 + r() * 0.12).toFixed(2)}"/>`);
        else if (r() < 0.5) o.push(`<polygon points="${[0, 1, 2, 3, 4, 5].map((k) => `${(x + s * 0.9 * Math.cos((Math.PI / 3) * k)).toFixed(1)},${(y + s * 0.9 * Math.sin((Math.PI / 3) * k)).toFixed(1)}`).join(" ")}" fill="none" stroke="#fff" stroke-width="1" opacity=".12"/>`);
      }
    }
  } else if (motif === "rangoli") {
    for (let row = -4; row <= 4; row++) {
      for (let col = -9; col <= 9; col++) {
        if ((Math.abs(row) + Math.abs(col)) % 2) continue;
        const d = Math.abs(row) * 1.6 + Math.abs(col);
        if (d > 11) continue;
        o.push(`<circle cx="${1050 + col * 34}" cy="${250 + row * 34}" r="${(5 - d * 0.2).toFixed(1)}" fill="#fff" opacity="${(0.8 - d * 0.04).toFixed(2)}"/>`);
      }
    }
    o.push(`<path d="M1050 70 L1250 250 L1050 430 L850 250Z" fill="none" stroke="#fff" stroke-width="2" opacity=".35"/><path d="M1050 130 L1190 250 L1050 370 L910 250Z" fill="none" stroke="#fff" stroke-width="2" opacity=".3"/>`);
    o.push(mandala(1050, 250, 70, 8));
    for (let i = 0; i < 9; i++) o.push(`<circle cx="${60 + i * 34}" cy="${430 - (i % 2) * 14}" r="4" fill="#fff" opacity=".28"/>`);
  } else if (motif === "skyline") {
    o.push(`<circle cx="1180" cy="170" r="80" fill="#fff" opacity=".16"/>`);
    let x = 520;
    while (x < 1500) {
      const w = 40 + Math.floor(r() * 50);
      const h = 120 + Math.floor(r() * 200);
      o.push(`<rect x="${x}" y="${500 - h}" width="${w}" height="${h}" fill="#000" opacity="${(0.12 + r() * 0.12).toFixed(2)}"/>`);
      for (let wy = 500 - h + 14; wy < 486; wy += 22) for (let wx = x + 8; wx < x + w - 8; wx += 14) if (r() < 0.45) o.push(`<rect x="${wx}" y="${wy}" width="6" height="9" fill="#fff" opacity=".4"/>`);
      x += w + 6;
    }
  } else if (motif === "mountains") {
    o.push(`<circle cx="1120" cy="150" r="70" fill="#fff" opacity=".22"/>`);
    o.push(`<path d="M300 500 L640 190 L860 380 L1000 260 L1260 500Z" fill="#000" opacity=".14"/>`);
    o.push(`<path d="M700 500 L1040 230 L1240 400 L1360 300 L1500 420 L1500 500Z" fill="#000" opacity=".2"/>`);
    o.push(`<path d="M0 500 L0 400 L220 300 L420 430 L560 350 L760 500Z" fill="#000" opacity=".16"/>`);
  } else {
    for (let i = 0; i < 6; i++) {
      const y = 160 + i * 46;
      const amp = 24 + r() * 26;
      o.push(`<path d="M0 ${y} C250 ${y - amp}, 500 ${y + amp}, 750 ${y} S1250 ${y - amp}, 1500 ${y}" fill="none" stroke="#fff" stroke-width="${2 + (i % 2)}" opacity="${(0.34 - i * 0.04).toFixed(2)}"/>`);
    }
    o.push(`<circle cx="1180" cy="150" r="64" fill="#fff" opacity=".14"/>`);
  }
  return o.join("");
}

export function coverArtSvg(role: RoleKey, seed: number): string {
  const r = mulberry32(seed * 104729 + 7);
  const [c1, c2] = COVER_PALETTES[(seed * 5 + 3) % COVER_PALETTES.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500" viewBox="0 0 1500 500" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
<radialGradient id="v" cx=".78" cy=".35" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="1500" height="500" fill="url(#g)"/><rect width="1500" height="500" fill="url(#v)"/>${motifArt(MOTIF_BY_ROLE[role], r)}
</svg>`;
}
