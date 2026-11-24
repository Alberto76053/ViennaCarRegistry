// Farbgruppen (für den Filter), Wiener Bezirke und kleine Helfer. Es gibt bewusst keine gezeichneten Autos.
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
