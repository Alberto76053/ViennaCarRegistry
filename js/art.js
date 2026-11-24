// Konstanten und die gezeichneten Platzhalter-Autos (werden gezeigt, wenn ein Spot kein Foto hat)
export const COLORS = {
  yellow: { hex: '#F2C200', n: ['Yellow', 'Gelb'] },
  red:    { hex: '#C4161C', n: ['Red', 'Rot'] },
  black:  { hex: '#1A1C20', n: ['Black', 'Schwarz'] },
  white:  { hex: '#F1F1EE', n: ['White', 'Weiß'] },
  silver: { hex: '#A9B0B8', n: ['Silver', 'Silber'] },
  blue:   { hex: '#1F4FA3', n: ['Blue', 'Blau'] },
  orange: { hex: '#E8680F', n: ['Orange', 'Orange'] },
  green:  { hex: '#1F6B4A', n: ['Green', 'Grün'] },
  grey:   { hex: '#6B737C', n: ['Grey', 'Grau'] }
};

export const BEZ = ['Innere Stadt', 'Leopoldstadt', 'Landstraße', 'Wieden', 'Margareten', 'Mariahilf', 'Neubau', 'Josefstadt', 'Alsergrund', 'Favoriten', 'Simmering', 'Meidling', 'Hietzing', 'Penzing', 'Rudolfsheim-Fünfhaus', 'Ottakring', 'Hernals', 'Währing', 'Döbling', 'Brigittenau', 'Floridsdorf', 'Donaustadt', 'Liesing'];
export const distLabel = n => `${1000 + n * 10} ${BEZ[n - 1] || ''}`.trim();

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let UID = 0;
export function shade(hex, p) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.round(p < 0 ? c * (1 + p) : c + (255 - c) * p);
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join('');
}

const BODY = {
  coupe:  { d: 'M18 92C18 84 26 80 44 78L96 72C118 52 150 40 196 38C238 36 270 42 296 56C312 64 326 70 348 74C372 78 388 84 390 92L390 100L18 100Z', g: 'M130 70C148 55 172 48 202 47C232 46 258 51 276 62L286 69Z' },
  wedge:  { d: 'M14 94L14 86L72 80L170 64C198 52 232 46 264 46L302 60L376 82C388 86 392 90 392 96L392 100L14 100Z', g: 'M180 63C206 53 234 49 260 49L290 61L196 67Z' },
  spyder: { d: 'M18 92C18 84 28 80 48 78L120 74C170 70 216 68 252 66L286 56C292 56 296 58 300 64C322 66 342 72 360 78C380 82 392 86 392 94L392 100L18 100Z', g: 'M254 66L284 57L296 65Z' }
};
const SCN = [['#BFCDD9', '#EEF0EC', '#A9B6C2', '#8C969E'], ['#4D5B82', '#F2BB85', '#2E3957', '#3A4258'], ['#0A0E17', '#1D2740', '#05070C', '#10141C']];

export function carSVG(hex, shape, scene, flip, label) {
  const u = 'c' + (++UID), b = BODY[shape] || BODY.coupe, P = SCN[scene % 3], night = scene % 3 === 2, lit = scene % 3 > 0;
  const t = flip ? 'translate(562 192) scale(-1.2 1.2)' : 'translate(78 192) scale(1.2)';
  const spokes = [0, 30, 60, 90, 120, 150].map(a => {
    const r = a * Math.PI / 180;
    return `<line x1="${(118 - 64 * Math.cos(r)).toFixed(1)}" y1="${(196 - 64 * Math.sin(r)).toFixed(1)}" x2="${(118 + 64 * Math.cos(r)).toFixed(1)}" y2="${(196 + 64 * Math.sin(r)).toFixed(1)}"/>`;
  }).join('');
  const win = night ? [[34, 262], [96, 246], [160, 240], [246, 252], [352, 246], [420, 236], [500, 258], [560, 244]].map(p => `<rect x="${p[0]}" y="${p[1]}" width="5" height="7" fill="#F2C200" opacity=".55"/>`).join('') : '';
  return `<svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(label || '')}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P[0]}"/><stop offset="1" stop-color="${P[1]}"/></linearGradient><linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(hex, .3)}"/><stop offset=".5" stop-color="${hex}"/><stop offset="1" stop-color="${shade(hex, -.4)}"/></linearGradient><radialGradient id="${u}l"><stop offset="0" stop-color="#FFD76A" stop-opacity=".6"/><stop offset="1" stop-color="#FFD76A" stop-opacity="0"/></radialGradient></defs>`
    + `<rect width="640" height="400" fill="url(#${u}s)"/>`
    + `<g stroke="${P[2]}" fill="none" stroke-width="2.2" opacity=".85"><circle cx="118" cy="196" r="64"/><circle cx="118" cy="196" r="6"/>${spokes}<path d="M118 196L96 300M118 196L140 300"/></g>`
    + `<path d="M0 300V250H30V232H62V256H92V240H120V262H150V228H178V250H210V236H240V258H276V246H300V220L310 150L320 220V246H356V234H388V258H420V240H452V262H486V230H520V252H552V238H590V256H640V300Z" fill="${P[2]}"/>${win}`
    + `<rect y="300" width="640" height="100" fill="${P[3]}"/><path d="M0 372H640" stroke="#fff" stroke-opacity=".28" stroke-width="3" stroke-dasharray="46 30"/>`
    + (night ? `<circle cx="566" cy="170" r="110" fill="url(#${u}l)"/>` : '')
    + `<ellipse cx="320" cy="340" rx="250" ry="9" fill="#000" opacity=".33"/>`
    + `<g transform="${t}"><path d="${b.d}" fill="url(#${u}b)"/><path d="${b.g}" fill="${night ? '#0B1018' : '#1B2430'}" opacity=".93"/><path d="M44 79C140 67 250 61 330 76" stroke="#fff" stroke-opacity=".34" stroke-width="2" fill="none"/><path d="M150 82L300 82" stroke="${shade(hex, -.5)}" stroke-opacity=".5" stroke-width="1.2"/>`
    + (lit ? `<ellipse cx="396" cy="86" rx="42" ry="15" fill="url(#${u}l)"/>` : '')
    + `<path d="M350 77L380 82L350 85Z" fill="#FFF7D6"/><rect x="16" y="85" width="11" height="4" rx="1" fill="#D1262B"/>`
    + `<circle cx="96" cy="100" r="26" fill="#0C0E12"/><circle cx="312" cy="100" r="26" fill="#0C0E12"/>`
    + `<g><circle cx="96" cy="100" r="22" fill="#14161A"/><circle cx="96" cy="100" r="13" fill="#C4CAD1"/><circle cx="96" cy="100" r="5" fill="#6B727A"/><circle cx="312" cy="100" r="22" fill="#14161A"/><circle cx="312" cy="100" r="13" fill="#C4CAD1"/><circle cx="312" cy="100" r="5" fill="#6B727A"/></g></g></svg>`;
}
