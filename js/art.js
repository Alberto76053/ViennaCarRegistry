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

// Bundesländer und Bezirke kommen aus der Datenbank (Tabellen regions und districts).
// Fehlt die Tabelle noch (ältere Einrichtung ohne update-4), gilt vorerst nur Wien.
const WIEN = ['Innere Stadt', 'Leopoldstadt', 'Landstraße', 'Wieden', 'Margareten', 'Mariahilf', 'Neubau', 'Josefstadt', 'Alsergrund', 'Favoriten', 'Simmering', 'Meidling', 'Hietzing', 'Penzing', 'Rudolfsheim-Fünfhaus', 'Ottakring', 'Hernals', 'Währing', 'Döbling', 'Brigittenau', 'Floridsdorf', 'Donaustadt', 'Liesing'];
export const GEO = { regions: [], districts: [], d: new Map(), r: new Map() };
export function setGeo(regions, districts) {
  GEO.regions = regions.slice().sort((a, b) => a.sort - b.sort);
  GEO.districts = districts.slice().sort((a, b) => a.sort - b.sort);
  GEO.d = new Map(GEO.districts.map(x => [x.id, x]));
  GEO.r = new Map(GEO.regions.map(x => [x.id, x]));
}
export const wienOnly = () => setGeo([{ id: 'wien', name: 'Wien', sort: 1, active: true }], WIEN.map((name, i) => ({ id: i + 1, region_id: 'wien', name, code: String(1010 + i * 10), sort: i + 1 })));
export const distLabel = id => { const d = GEO.d.get(id); return d ? (d.code ? `${d.code} ${d.name}` : d.name) : ''; };
export const regionName = id => { const d = GEO.d.get(id), r = d && GEO.r.get(d.region_id); return r ? r.name : ''; };
export const regionOf = id => { const d = GEO.d.get(id); return d ? d.region_id : ''; };

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
