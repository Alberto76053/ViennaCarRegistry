// Vienna Car Registry – Oberfläche
import * as api from './api.js?v=7';
import { OAUTH_PROVIDERS } from './config.js';
import { COLORS, GEO, setGeo, wienOnly, distLabel, regionName, regionOf, esc } from './art.js?v=7';

/* ---------- Helfer ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
const pad = n => String(n).padStart(4, '0');

const S = {
  lang: LS('vcr-lang') === 'de' ? 'de' : 'en',
  theme: LS('vcr-theme') === 'light' ? 'light' : 'dark',
  configured: false, route: 'home', arg: '', pi: 0, tok: 0,
  me: null, status: null, models: [], specs: {}, paints: {},
  likes: new Set(), favs: new Set(), following: new Set(), blocked: new Set(), notes: [],
  f: { q: '', brand: '', model: '', color: '', region: '', sort: 'new', n: 24 }, menu: false, ptab: 'details', homeTab: 'likes', carPhotos: [],
  list: [], modal: null, authTab: 'in', adminTab: 'spots', notifOpen: false,
  msgWith: null, up: { files: [], kind: 'registry', busy: false }, errUp: '', applied: false,
  cache: new Map()
};
const L = (en, de) => (S.lang === 'de' ? de : en);
const fd = iso => new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString(S.lang === 'de' ? 'de-AT' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const cn = k => COLORS[k].n[S.lang === 'de' ? 1 : 0];
const ARCH = { ex: ['Ex-Viennese car', 'Ex-Wiener Auto'], visit: ['Visited Vienna', 'Zu Besuch in Wien'], event: ['Event car in Vienna', 'Event-Auto in Wien'] };
const ARCHG = { ex: ['Ex-Viennese cars', 'Ex-Wiener Autos'], visit: ['Cars that visited Vienna', 'Zu Besuch in Wien'], event: ['Event cars in Vienna', 'Event-Autos in Wien'] };
const archL = k => ARCH[k][S.lang === 'de' ? 1 : 0];
const REASONS = { wrong: ['Wrong information', 'Falsche Angaben'], inappropriate: ['Inappropriate', 'Unangemessen'], spam: ['Spam', 'Spam'], private: ['Private data visible', 'Private Daten sichtbar'] };

const loggedIn = () => !!S.me;
const isAdmin = () => !!S.me && (S.me.role === 'admin' || S.me.role === 'ceo');
const isCeo = () => !!S.me && S.me.role === 'ceo';
const isPro = () => !!S.me && (S.me.is_pro || isAdmin());
const banned = () => !!(S.status && S.status.banned);
const modelOf = id => S.models.find(m => m.id === id) || { id, brand: '', name: id };
const spotName = s => { const m = modelOf(s.model_id); return `${m.brand} ${m.name}`.trim(); };

const cached = (k, fn) => { if (!S.cache.has(k)) S.cache.set(k, fn()); return S.cache.get(k).catch(e => { S.cache.delete(k); throw e; }); };
const bust = () => S.cache.clear();

function toast(m) {
  const t = $('#toast'); if (!t) return;
  t.textContent = m; t.classList.add('on');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 3200);
}
function errMsg(e) {
  const m = String((e && e.message) || e || '');
  if (e && e.code === '23505') return L('That name or entry already exists.', 'Dieser Name oder Eintrag existiert schon.');
  if (/row-level security|42501|permission denied/i.test(m)) return banned() ? L('Your account is suspended.', 'Dein Konto ist gesperrt.') : L('You are not allowed to do that.', 'Das darfst du nicht.');
  if (/gesperrt/i.test(m)) return L('Your account is suspended.', 'Dein Konto ist gesperrt.');
  if (/Invalid login/i.test(m)) return L('Email or password is wrong.', 'E-Mail oder Passwort stimmt nicht.');
  if (/Failed to fetch|NetworkError/i.test(m)) return L('No connection. Try again.', 'Keine Verbindung. Versuch es nochmal.');
  return m || L('Something went wrong.', 'Etwas ist schiefgelaufen.');
}

const IC = {
  heart: '<path d="M12 20s-7-4.4-9-9.1C1.7 7.6 3.5 4.5 6.7 4.5c2 0 3.4 1.1 5.3 3.1 1.9-2 3.3-3.1 5.3-3.1 3.2 0 5 3.1 3.7 6.4C19 15.6 12 20 12 20z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  flag: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',
  bell: '<path d="M6 16v-5a6 6 0 1112 0v5l2 2H4l2-2zM10 21a2 2 0 004 0"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 118 0v3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  car: '<path d="M4 16v-4l2-5h12l2 5v4M3 16h18M7 16v2.5M17 16v2.5"/><circle cx="8" cy="13" r=".8"/><circle cx="16" cy="13" r=".8"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  cam: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  drop: '<path d="M12 3s6 6.4 6 11a6 6 0 11-12 0c0-4.6 6-11 6-11z"/>',
  pal: '<path d="M12 3a9 9 0 100 18c1.5 0 2-1 1.6-2-.5-1.2.2-2.5 1.6-2.5H17a4 4 0 004-4c0-5-4-9.5-9-9.5z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10.5" cy="7" r="1.1"/><circle cx="15" cy="7.5" r="1.1"/>',
  hash: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
  eng: '<path d="M4 9h3l1-2h6l1 2h2v2h2v4h-2v2H7l-3-3z"/><path d="M10 12h4"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 14.5V21M9.8 11H3.2M14.2 11h6.6"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  spec: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/>'
};
const ic = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

/* ---------- Bausteine ---------- */
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
function av(p, size) {
  p = p || { username: '?' };
  const sz = size || 36;
  return `<span class="av" style="--s:${sz}px;background:hsl(${hue(p.username)} 42% 40%)">${p.avatar_path ? `<img src="${esc(api.photoUrl(p.avatar_path, 'avatars'))}" alt="">` : esc((p.username || '?')[0].toUpperCase())}</span>`;
}
const MENTION = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,20})/g;
const mentionHTML = (body, known) => esc(body).replace(MENTION, (m, pre, name) => {
  const n = name.toLowerCase();
  return known && known[n] ? `${pre}<a class="mention" href="#profile-${n}">@${n}</a>` : m;
});
// Abzeichen: Zahlen kommen aus der Ansicht profile_badge_stats, hier steht nur, ab wann es eins gibt
const BADGES = [
  { id: 'first',     i: 'car',   k: 'cars',           n: 1,  t: ['First car', 'Erstes Auto'],               d: ['An admin approved your first car', 'Ein Admin hat dein erstes Auto freigegeben'] },
  { id: 'collector', i: 'car',   k: 'cars',           n: 10, t: ['Collector', 'Sammler'],                    d: ['10 approved cars', '10 freigegebene Autos'] },
  { id: 'spotter',   i: 'cam',   k: 'sightings',      n: 10, t: ['Spotter', 'Späher'],                       d: ['10 sightings', '10 Sichtungen'] },
  { id: 'eagle',     i: 'cam',   k: 'sightings',      n: 50, t: ['Eagle eye', 'Adleraugen'],                 d: ['50 sightings', '50 Sichtungen'] },
  { id: 'local',     i: 'pin',   k: 'districts',      n: 5,  t: ['Local scout', 'Bezirks-Späher'],           d: ['Sightings in 5 districts', 'Sichtungen in 5 Bezirken'] },
  { id: 'wide',      i: 'pin',   k: 'districts',      n: 15, t: ['All around', 'Weit unterwegs'],            d: ['Sightings in 15 districts', 'Sichtungen in 15 Bezirken'] },
  { id: 'states',    i: 'pin',   k: 'regions',        n: 2,  t: ['Across the border', 'Über Landesgrenzen'], d: ['Sightings in 2 states', 'Sichtungen in 2 Bundesländern'] },
  { id: 'liked',     i: 'heart', k: 'likes_received', n: 25, t: ['Crowd favourite', 'Publikumsliebling'],    d: ['25 likes on your cars', '25 Likes auf deine Autos'] },
  { id: 'chatty',    i: 'chat',  k: 'comments',       n: 20, t: ['Chatty', 'Gesprächig'],                    d: ['20 comments', '20 Kommentare'] }
];
function badgesHTML(bs) {
  const st = bs || {};
  const v = b => +st[b.k] || 0;
  const list = BADGES.slice().sort((a, b) => (v(b) >= b.n) - (v(a) >= a.n));
  const got = list.filter(b => v(b) >= b.n).length;
  return `<h2 style="margin-top:36px">${L('Badges', 'Abzeichen')} <small class="mute" style="font:700 17px var(--body)">${got} / ${BADGES.length}</small></h2>
<ul class="badges">${list.map(b => { const on = v(b) >= b.n; return `<li class="badge${on ? ' on' : ''}"><span class="bi">${ic(b.i)}</span><div><strong>${esc(b.t[S.lang === 'de' ? 1 : 0])}</strong><span class="mute sm">${esc(b.d[S.lang === 'de' ? 1 : 0])}</span>${on ? '' : `<span class="prog" role="img" aria-label="${v(b)} / ${b.n}"><i style="width:${Math.min(100, Math.round(v(b) / b.n * 100))}%"></i></span>`}</div></li>`; }).join('')}</ul>`;
}
const uLink = p => p ? `<a href="#profile-${esc(p.username)}">@${esc(p.username)}</a>${p.is_pro ? ' <span class="pro">Pro</span>' : ''}` : '—';
const plate = (s, lg) => `<span class="plate${lg ? ' lg' : ''}"><i></i><b>VCR ${pad(s.id)}</b><i></i></span>`;

function photoHTML(s, i) {
  i = i || 0;
  const url = (s.photos || [])[i];
  if (url) return `<img src="${esc(url)}" alt="${esc(spotName(s))}" loading="lazy">`;
  return `<div class="nophoto"><span>${esc(spotName(s))}</span></div>`;
}
const ico = (n, v, t) => `<div class="icons_info" title="${esc(t)}"><i>${ic(n)}</i><span>${v}</span></div>`;
const tile = s => {
  const m = modelOf(s.model_id);
  return `<div class="car_item"><a class="tile" href="#car-${s.id}"><div class="image">${photoHTML(s, 0)}</div>
<div class="texto"><p class="title"><i class="flag" role="img" aria-label="Austria"></i><span class="t">${esc(spotName(s))}</span>${s.paint ? `<small>${esc(s.paint)}</small>` : ''}</p>
<div class="icons_row">${ico('heart', s.likes || 0, L('Likes', 'Likes'))}${ico('chat', s.comments || 0, L('Comments', 'Kommentare'))}${ico('pin', s.district, distLabel(s.district))}${ico('cam', Math.max((s.photos || []).length, 0), L('Photos', 'Fotos'))}</div></div></a></div>`;
};

function header() {
  const nav = [['cars', L('Cars', 'Autos')], ['archive', L('Archive', 'Archiv')], ['events', 'Events'], ['ranking', 'Ranking']];
  if (isAdmin()) nav.push(['admin', 'Admin']);
  const cur = S.route === 'car' || S.route === 'home' ? (S.route === 'car' ? 'cars' : '') : S.route;
  const unread = S.notes.filter(n => !n.read).length;
  const lock = `<svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2">${IC.lock}</svg>`;
  const lk = (n, cls) => `<a href="#${n[0]}"${cur === n[0] ? ' aria-current="page"' : ''}${cls ? ` class="${cls}"` : ''}>${n[1]}${n[0] === 'archive' && !isPro() ? lock : ''}</a>`;
  const links = nav.map(n => lk(n)).join('') + `<a class="add" href="#upload">${L('Upload a car', 'Auto hochladen')}</a>`;
  const langBtns = `<span class="lang" role="group" aria-label="Language"><button data-act="lang" data-v="en" aria-pressed="${S.lang === 'en'}">EN</button><button data-act="lang" data-v="de" aria-pressed="${S.lang === 'de'}">DE</button></span>`;
  const themeBtn = `<button class="ibtn" data-act="theme" aria-label="${L('Switch light/dark mode', 'Hell/Dunkel umschalten')}">${ic(S.theme === 'dark' ? 'sun' : 'moon')}</button>`;
  return `<a class="skip" href="#home" data-act="skip">${L('Skip to content', 'Zum Inhalt springen')}</a>
<header class="top"><div class="topg">
<button class="ibtn burger" data-act="menu" aria-label="${L('Menu', 'Menü')}" aria-expanded="${S.menu}">${ic('menu')}</button>
<a class="brand" href="#home"><span class="plate"><i></i><b>VCR</b><i></i></span><span class="bn">Vienna Car Registry</span></a>
<nav class="main-nav" aria-label="Main">${links}</nav>
<div class="tools">
<form class="hsearch" role="search" data-form="search"><label class="sr" for="hs">${L('Search', 'Suche')}</label><input id="hs" name="q" type="search" placeholder="${L('Search', 'Suche')}" autocomplete="off"><button type="submit" aria-label="${L('Search', 'Suchen')}">${ic('search')}</button></form>
<span class="add-d">${langBtns}${themeBtn}</span>
${S.me ? `<button class="ibtn" data-act="bell" aria-label="${L('Notifications', 'Benachrichtigungen')}" aria-expanded="${S.notifOpen}">${ic('bell')}${unread ? `<span class="dot">${unread}</span>` : ''}</button>
<a class="ibtn" href="#messages" aria-label="${L('Messages', 'Nachrichten')}">${ic('mail')}</a>
<a href="#profile-${esc(S.me.username)}" aria-label="${L('My profile', 'Mein Profil')}">${av(S.me, 32)}</a>`
    : `<button class="ibtn" data-act="login" aria-label="${L('Sign in', 'Anmelden')}">${ic('user')}</button>`}
</div></div>
<nav class="mnav" aria-label="Menu" ${S.menu ? '' : 'hidden'}>${nav.map(n => lk(n)).join('')}<a href="#upload">${L('Upload a car', 'Auto hochladen')}</a><a href="#pro">Pro</a>
<div class="row" style="padding:6px 4px">${langBtns}${themeBtn}</div></nav>
${S.notifOpen && S.me ? notifPanel() : ''}</header>`;
}
function notifPanel() {
  return `<div class="notif"><div class="row" style="justify-content:space-between;padding:10px 0 4px"><strong>${L('Notifications', 'Benachrichtigungen')}</strong><button class="linkb sm" data-act="readall">${L('Mark all read', 'Alle gelesen')}</button></div><ul>${S.notes.length ? S.notes.map(n => `<li class="${n.read ? '' : 'un'}">${esc(S.lang === 'de' ? n.text_de : n.text_en)}</li>`).join('') : `<li>${L('Nothing yet.', 'Noch nichts.')}</li>`}</ul></div>`;
}
function footer() {
  return `<button class="totop" data-act="top" aria-label="${L('Back to top', 'Nach oben')}">${ic('up')}</button>
<footer class="foot"><div class="fg"><div class="fb"><a class="brand" href="#home"><span class="plate"><i></i><b>VCR</b><i></i></span><span>Vienna Car Registry</span></a>
<p class="tag2">${L('Spotted in Austria. Checked by admins.', 'In Österreich gespottet. Von Admins geprüft.')}</p></div>
<div class="cols2"><div class="col"><p>${L('Resources', 'Ressourcen')}</p><a href="#cars">${L('Cars', 'Autos')}</a><a href="#archive">${L('Archive', 'Archiv')}</a><a href="#events">Events</a><a href="#ranking">Ranking</a></div>
<div class="col"><p>${L('Community', 'Community')}</p><a href="#upload">${L('Upload a car', 'Auto hochladen')}</a><a href="#pro">Pro</a>${S.me && !isAdmin() ? `<a href="#apply">${L('Become an admin', 'Admin werden')}</a>` : ''}${S.me ? `<button data-act="logout">${L('Sign out', 'Abmelden')}</button>` : `<button data-act="login">${L('Sign in', 'Anmelden')}</button>`}</div></div></div>
<p class="copy">© ${new Date().getFullYear()} Vienna Car Registry. ${L('All rights reserved.', 'Alle Rechte vorbehalten.')}</p></footer>`;
}
const head = (t, sub) => `<section class="wrap ph0"><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ''}</section>`;
const gate = (title, txt) => head(title, txt) + `<div class="wrap sec"><button class="btn" data-act="login">${L('Sign in or create account', 'Anmelden oder Konto erstellen')}</button></div>`;
const notFound = guest => head(L('Not found', 'Nicht gefunden'), L('This page does not exist, or it is not public.', 'Diese Seite gibt es nicht oder sie ist nicht öffentlich.')) + `<div class="wrap sec"><div class="row"><a class="btn" href="#home">${L('Back to the registry', 'Zurück zum Register')}</a>${guest && !S.me ? `<button class="btn ghost" data-act="login">${L('Sign in', 'Anmelden')}</button>` : ''}</div></div>`;
const loadingHTML = () => `<div class="loading" role="status">${L('Loading…', 'Lädt …')}</div>`;

function setupPage() {
  return `<div class="setup"><h1 style="font-size:40px">Vienna Car Registry</h1>
<p class="mute" style="margin-top:14px">${L('The site is not connected to a database yet.', 'Die Seite ist noch nicht mit einer Datenbank verbunden.')}</p>
<ol><li>${L('Create a free project at supabase.com.', 'Lege auf supabase.com ein kostenloses Projekt an.')}</li>
<li>${L('Run the file', 'Führe die Datei')} <code>supabase/schema.sql</code> ${L('in the SQL Editor.', 'im SQL Editor aus.')}</li>
<li>${L('Put the project URL and the anon key into', 'Trage Projekt-URL und anon-Key in')} <code>js/config.js</code> ${L('.', 'ein.')}</li></ol>
<p>${L('The full guide is in SETUP.md in the repository.', 'Die ganze Anleitung steht in SETUP.md im Repository.')}</p></div>`;
}

/* ---------- Seiten ---------- */
function filtered() {
  const f = S.f, q = f.q.trim().toLowerCase();
  let a = S.list.filter(s => !S.blocked.has(s.user_id));
  if (f.brand) a = a.filter(s => modelOf(s.model_id).brand === f.brand);
  if (f.model) a = a.filter(s => s.model_id === f.model);
  if (f.color) a = a.filter(s => s.color === f.color);
  if (f.region) a = a.filter(s => regionOf(s.district) === f.region);
  if (q) a = a.filter(s => (spotName(s) + ' ' + COLORS[s.color].n.join(' ') + ' ' + (s.paint || '')).toLowerCase().includes(q));
  a = a.slice().sort(f.sort === 'likes' ? (x, y) => (y.likes - x.likes) || (y.id - x.id) : (x, y) => (y.id - x.id));
  return a;
}
function gridHTML() {
  const a = filtered();
  if (!S.list.length) return `<div class="car_list"><div class="empty"><h2>${L('No cars yet', 'Noch keine Autos')}</h2><p>${L('Be the first to upload a car you saw in Austria.', 'Lade als Erste oder Erster ein Auto hoch, das du in Österreich gesehen hast.')}</p><a class="btn" href="#upload">${L('Upload a car', 'Auto hochladen')}</a></div></div>`;
  if (!a.length) return `<div class="car_list"><div class="empty"><h2>${L('No cars match these filters', 'Keine Autos für diese Filter')}</h2><p>${L('Try another colour or model, or clear the filters.', 'Probiere eine andere Farbe oder ein anderes Modell oder setze die Filter zurück.')}</p><button class="btn" data-act="clear">${L('Clear filters', 'Filter zurücksetzen')}</button></div></div>`;
  const shown = a.slice(0, S.f.n);
  return `<div class="car_list">${shown.map(tile).join('')}</div>${a.length > shown.length ? `<div class="more"><button class="btn" data-act="more">${L('See more', 'Mehr anzeigen')}</button></div>` : ''}`;
}
const countText = () => { const n = filtered().length; return L(`(${n} ${n === 1 ? 'Car' : 'Cars'} found)`, `(${n} ${n === 1 ? 'Auto' : 'Autos'} gefunden)`); };
const stat = (i, n, l) => `<div class="stat"><span class="n">${ic(i)}${n}</span><span class="l">${l}</span></div>`;
const blockTitle = (t, sub) => `<h2 class="blocktitle">${t}${sub ? `<span class="sub">${sub}</span>` : ''}</h2>`;

async function pageHome() {
  S.list = await cached('reg', () => api.listSpots('registry'));
  const evs = await cached('events', () => api.listEvents()).catch(() => []);
  const vis = S.list.filter(s => !S.blocked.has(s.user_id));
  const cotm = await cached('cotm', () => api.loadCarOfMonth().catch(() => null));
  const brands = [...new Set(S.models.map(m => m.brand))];
  const nModels = new Set(vis.map(s => s.model_id)).size, nDist = new Set(vis.map(s => s.district)).size;
  const nLikes = vis.reduce((t, s) => t + (s.likes || 0), 0);
  const pop = vis.slice().sort(S.homeTab === 'new' ? (x, y) => y.id - x.id : (x, y) => (y.likes - x.likes) || (y.id - x.id)).slice(0, 8);
  const today = new Date().toISOString().slice(0, 10);
  const up = evs.filter(e => e.starts_on >= today).slice(0, 4);
  const mo = d => new Date(d + 'T12:00:00').toLocaleDateString(S.lang === 'de' ? 'de-AT' : 'en-GB', { month: 'short', year: 'numeric' });
  const perBrand = b => { const ms = S.models.filter(m => m.brand === b), ids = new Set(ms.map(m => m.id)); return [ms.length, vis.filter(s => ids.has(s.model_id)).length]; };
  const brandCards = brands.slice(0, 14).map(b => { const c = perBrand(b); return `<button class="brandc" data-act="brandf" data-v="${esc(b)}"><span class="logo" aria-hidden="true">${esc(b[0])}</span><b>${esc(b)}</b><div class="cnts"><div><strong>${c[0]}</strong><span>${c[0] === 1 ? L('Model', 'Modell') : L('Models', 'Modelle')}</span></div><div><strong>${c[1]}</strong><span>${c[1] === 1 ? L('Car', 'Auto') : L('Cars', 'Autos')}</span></div></div></button>`; }).join('');
  const modCards = S.models.slice(0, 10).map(m => {
    const ss = vis.filter(s => s.model_id === m.id).sort((x, y) => (y.likes - x.likes) || (y.id - x.id)), sp = S.specs[m.id] || {};
    const ph = ss.find(x => (x.photos || []).length);
    const facts = [sp.engine, sp.power, sp.year].filter(Boolean).join(' · ');
    return `<button class="modc" data-act="modelf" data-v="${esc(m.id)}"><div class="image">${ph ? photoHTML(ph, 0) : `<div class="nophoto"><span>${esc(m.brand)}</span></div>`}</div><div class="t"><b>${esc(m.brand)} ${esc(m.name)}</b><p>${esc(facts) || (ss.length ? `${ss.length} ${ss.length === 1 ? L('car in Austria', 'Auto in Österreich') : L('cars in Austria', 'Autos in Österreich')}` : L('No cars in Austria yet.', 'Noch keine Autos in Österreich.'))}</p></div></button>`;
  }).join('');
  const cat = (href, i, n, t, d) => `<a class="cat" href="#${href}"><span class="upd">${ic(i)}${n}</span><div class="in"><h3>${t}</h3><p>${d}</p><span class="go">${L('Explore category', 'Kategorie ansehen')} →</span></div></a>`;
  return `<section class="wrap hero"><p class="welcome">${L('Welcome to', 'Willkommen bei')}</p><h1>Vienna Car Registry</h1>
<p class="lead">${L('Explore the exclusive cars spotted in Austria, with official data and paint names.', 'Entdecke die exklusiven Autos, die in Österreich gespottet wurden, mit offiziellen Daten und Lacknamen.')}</p>
<form class="bigsearch" role="search" data-form="search"><label class="sr" for="q">${L('Search', 'Suche')}</label><input id="q" name="q" type="search" placeholder="${L('Search for Make or Model', 'Marke oder Modell suchen')}" autocomplete="off"><button type="submit" aria-label="${L('Search', 'Suchen')}">${ic('search')}</button></form>
<div class="stats">${stat('car', vis.length, L('Cars registered', 'Autos im Register'))}${stat('star', nModels, L('Models', 'Modelle'))}${stat('pin', nDist, L('Districts', 'Bezirke'))}${stat('heart', nLikes, L('Likes', 'Likes'))}</div></section>
${cotm && !S.blocked.has(cotm.spot.user_id) ? `<section class="wrap blk"><a class="cotm" href="#car-${cotm.spot.id}"><div class="cimg">${photoHTML(cotm.spot, 0)}</div><div class="ctxt"><span class="tag ok">${L('Car of the month', 'Auto des Monats')} · ${new Date(cotm.month).toLocaleDateString(S.lang === 'de' ? 'de-AT' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })}</span><h2>${esc(spotName(cotm.spot))}</h2><p class="mute">${esc(distLabel(cotm.spot.district))}, ${esc(regionName(cotm.spot.district))}</p><p class="clk">${ic('heart')} ${cotm.likes} ${cotm.likes === 1 ? L('like', 'Like') : L('likes', 'Likes')} ${L('this month', 'in diesem Monat')}</p></div></a></section>` : ''}
<section class="wrap blk" id="reg">${blockTitle(L('Most Popular', 'Beliebteste'), L('(Most liked)', '(Meiste Likes)'))}
<div class="selection" role="group" aria-label="${L('Sort', 'Sortierung')}"><button data-act="hometab" data-v="likes" aria-pressed="${S.homeTab === 'likes'}">${L('Likes', 'Likes')}</button><button data-act="hometab" data-v="new" aria-pressed="${S.homeTab === 'new'}">${L('Latest', 'Neueste')}</button></div>
${pop.length ? `<div class="car_list">${pop.map(tile).join('')}</div>` : gridHTML()}
${vis.length ? `<div class="more"><a class="btn" href="#cars">${L('See more', 'Mehr anzeigen')}</a></div>` : ''}</section>
${up.length ? `<section class="wrap blk">${blockTitle(L('Latest Events', 'Nächste Events'))}<div class="car_list">${up.map(e => `<a class="car_item" href="#events"><div class="texto"><p class="title"><span class="t">${esc(e.title)}</span></p><div class="icons_row">${ico('cal', `${+e.starts_on.slice(8, 10)} ${mo(e.starts_on)}`, L('Date', 'Datum'))}${e.place || e.district ? ico('pin', esc(e.place || distLabel(e.district)), L('Place', 'Ort')) : ''}</div></div></a>`).join('')}</div><div class="more"><a class="btn" href="#events">${L('See more', 'Mehr anzeigen')}</a></div></section>` : ''}
${brands.length ? `<section class="wrap blk">${blockTitle(L('Explore - Make', 'Entdecken - Marken'))}<div class="brands">${brandCards}</div></section>` : ''}
${S.models.length ? `<section class="wrap blk">${blockTitle(L('Explore - Models', 'Entdecken - Modelle'))}<div class="models">${modCards}</div><div class="more"><a class="btn" href="#cars">${L('See more', 'Mehr anzeigen')}</a></div></section>` : ''}
<section class="wrap blk"><p class="tagline">${L('Every car is checked by an admin before it goes live.', 'Jedes Auto wird von einem Admin geprüft, bevor es online geht.')}</p>
<div class="cats">${cat('cars', 'car', vis.length, L('Cars', 'Autos'), L('Browse every exclusive car spotted in Austria.', 'Alle exklusiven Autos ansehen, die in Österreich gespottet wurden.'))}${cat('archive', 'lock', '', L('Archive', 'Archiv'), L('Ex-Viennese cars, visitors and event cars. Part of Pro.', 'Ex-Wiener Autos, Besucher und Event-Autos. Teil von Pro.'))}${cat('events', 'cal', up.length, 'Events', L('Meets and shows across Austria.', 'Treffen und Shows in ganz Österreich.'))}${cat('ranking', 'star', '', 'Ranking', L('The spotters with the most approved uploads.', 'Die Spotter mit den meisten freigegebenen Uploads.'))}</div></section>`;
}

async function pageCars() {
  S.list = await cached('reg', () => api.listSpots('registry'));
  const f = S.f;
  const brands = [...new Set(S.models.map(m => m.brand))];
  const models = S.models.filter(m => !f.brand || m.brand === f.brand);
  return `<section class="wrap pagehead"><h1>${L('Search Cars', 'Autos suchen')} <small id="count">${countText()}</small></h1></section>
<section class="wrap" id="reg"><form class="box_fields" data-form="filters" role="search">
<div class="f big"><label for="q">${L('Search', 'Suche')}</label><input id="q" type="search" placeholder="${L('Make, model or paint', 'Marke, Modell oder Lack')}" value="${esc(f.q)}" autocomplete="off"></div>
<div class="f"><label for="fb">${L('Make', 'Marke')}</label><select id="fb"><option value="">${L('All brands', 'Alle Marken')}</option>${brands.map(b => `<option${f.brand === b ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>
<div class="f"><label for="fm">${L('Model', 'Modell')}</label><select id="fm"><option value="">${L('All models', 'Alle Modelle')}</option>${models.map(m => `<option value="${esc(m.id)}"${f.model === m.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
${GEO.regions.filter(r => r.active).length > 1 ? `<div class="f"><label for="fr">${L('State', 'Bundesland')}</label><select id="fr"><option value="">${L('All states', 'Alle Bundesländer')}</option>${GEO.regions.filter(r => r.active).map(r => `<option value="${esc(r.id)}"${f.region === r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>` : ''}
<div class="f"><label for="fc">${L('Colour', 'Farbe')}</label><select id="fc"><option value="">${L('All colours', 'Alle Farben')}</option>${Object.keys(COLORS).map(k => `<option value="${k}"${f.color === k ? ' selected' : ''}>${cn(k)}</option>`).join('')}</select></div>
<div class="btns"><button type="button" class="btn ghost sm" data-act="clear">${L('Reset', 'Zurücksetzen')}</button><button type="submit" class="btn sm fill">${L('Search', 'Suchen')}</button></div></form>
<div class="selection" role="group" aria-label="${L('Sort', 'Sortierung')}"><button data-act="sort" data-v="new" aria-pressed="${f.sort === 'new'}">${L('Newest', 'Neueste')}</button><button data-act="sort" data-v="likes" aria-pressed="${f.sort === 'likes'}">${L('Most liked', 'Meiste Likes')}</button></div>
<div id="gridwrap">${gridHTML()}</div></section>`;
}

function lockedArchive() {
  return head('Vienna Archives', L('Ex-Viennese cars, visitors from abroad and event cars. Archive access is part of Pro.', 'Ex-Wiener Autos, Besucher aus dem Ausland und Event-Autos. Der Archiv-Zugang gehört zu Pro.'))
    + `<div class="wrap sec"><div class="row"><a class="btn" href="#pro">${L('See Pro', 'Pro ansehen')}</a>${S.me ? '' : `<button class="btn ghost" data-act="login">${L('Sign in', 'Anmelden')}</button>`}</div></div>`;
}
async function pageArchive() {
  if (!isPro()) return lockedArchive();
  const a = (await cached('arc', () => api.listSpots('archive'))).filter(s => !S.blocked.has(s.user_id));
  const grp = k => { const g = a.filter(s => s.arch_kind === k); return g.length ? `<h2>${ARCHG[k][S.lang === 'de' ? 1 : 0]}</h2><div class="car_list">${g.map(tile).join('')}</div>` : ''; };
  return head('Vienna Archives', L('Cars that left Vienna, visited it, or showed up at an event.', 'Autos, die Wien verlassen haben, zu Besuch waren oder bei einem Event auftauchten.'))
    + `<div class="wrap sec">${a.length ? grp('ex') + grp('visit') + grp('event') : `<p class="mute">${L('The archive is empty so far.', 'Das Archiv ist noch leer.')}</p>`}</div>`;
}

async function pageCar(id) {
  if (!/^\d+$/.test(id)) return notFound();
  const d = await cached('car' + id, () => api.getSpot(id));
  if (!d) return notFound(true);
  const s = d.spot, m = modelOf(s.model_id);
  s.photos = d.photos; S.carPhotos = d.photos;
  const n = d.photos.length, pi = Math.min(S.pi, Math.max(n - 1, 0));
  const owner = d.authors[s.user_id];
  const mine = S.me && S.me.id === s.user_id;
  const marks = d.marks || [];
  const myMark = !!(S.me && marks.some(x => x.user_id === S.me.id));
  const canEdit = !!(mine || (myMark && s.status === 'approved'));
  const sp = S.specs[s.model_id] || {};
  // Galerie: ein großes Bild links, bis zu vier kleine rechts
  const others = d.photos.map((u, i) => i).filter(i => i !== pi).slice(0, 4);
  const gcls = n <= 1 ? 'g1' : others.length === 1 ? 'g2' : others.length === 2 ? 'g3' : 'g4';
  const small = others.map((i, k) => `<button class="thumb" data-act="thumb" data-i="${i}" aria-label="${L('Photo', 'Foto')} ${i + 1}">${photoHTML(s, i)}${k === 3 && n > 5 ? `<span class="more_ph">${L('All Photos', 'Alle Fotos')} (${n})</span>` : ''}</button>`).join('');
  const gallery = `<div class="banner_gallery ${gcls}"><button class="thumb" data-act="allphotos" aria-label="${L('Show all photos', 'Alle Fotos anzeigen')}">${photoHTML(s, pi)}</button>${small}</div>`;
  const pr = s.paint ? (S.paints[s.model_id] || []).find(x => x.name === s.paint) : null;
  const dash = v => (v == null || v === '' ? '—' : esc(v));
  const login = `<button class="pill" data-act="login">${ic('user')} ${L('Log in', 'Anmelden')}</button>`;
  const row = (i, k, v) => `<div><span class="ico">${ic(i)}</span><div class="vwrap"><span class="k">${k}</span><span class="v">${v}</span></div></div>`;
  const mem = v => (S.me ? v : login);
  const detRows = row('pal', s.paint ? L('Paint', 'Lack') : L('Colour', 'Farbe'), s.paint ? `${pr ? `<i class="swd" style="background:${esc(pr.hex)}"></i>` : ''}${esc(s.paint)}` : esc(cn(s.color)))
    + (s.paint ? row('drop', L('Colour family', 'Farbgruppe'), esc(cn(s.color))) : '')
    + row('pin', L('District', 'Bezirk'), esc(distLabel(s.district)))
    + row('hash', L('Production no.', 'Produktionsnr.'), mem(d.details && d.details.prod_no ? `${esc(d.details.prod_no)}${sp.production ? ' / ' + sp.production : ''}` : '—'));
  const specRows = row('eng', L('Engine', 'Motor'), mem(dash(sp.engine))) + row('bolt', L('Power', 'Leistung'), mem(dash(sp.power))) + row('gear', L('Transmission', 'Getriebe'), mem(dash(sp.transmission)))
    + row('wheel', L('Drive', 'Antrieb'), mem(dash(sp.drive))) + row('cal', L('Year', 'Baujahr'), mem(dash(sp.year)))
    + (S.me && sp.source && /^https:\/\//.test(sp.source) ? `<p class="src">${L('Source of the technical data:', 'Quelle der technischen Daten:')} <a href="${esc(sp.source)}" target="_blank" rel="noopener noreferrer">${esc(sp.source.replace(/^https:\/\/(www\.)?/, '').split('/')[0])}</a></p>` : '');
  const tab = S.ptab === 'specs' ? 'specs' : 'details';
  const panel = `<aside class="panel"><div class="ptabs" role="group" aria-label="${L('Car data', 'Fahrzeugdaten')}"><button data-act="ptab" data-v="details" aria-pressed="${tab === 'details'}">${ic('info')}${L('Details', 'Details')}</button><button data-act="ptab" data-v="specs" aria-pressed="${tab === 'specs'}">${ic('spec')}${L('Specifics', 'Technik')}</button></div>
<div class="pbody"><dl class="facts">${tab === 'details' ? detRows : specRows}</dl></div></aside>`;
  const liked = S.likes.has(s.id), fav = S.favs.has(s.id);
  const cs = d.comments.filter(c => !S.blocked.has(c.user_id));
  let pend = '';
  if (s.status === 'pending') pend = `<div class="banner" style="margin-top:14px">${isAdmin() && !mine ? L('This car waits for review.', 'Dieses Auto wartet auf Prüfung.') : L('Only you can see this car until an admin approves it.', 'Nur du siehst dieses Auto, bis ein Admin es freigibt.')}${isAdmin() ? `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="approve" data-id="${s.id}">${L('Approve', 'Freigeben')}</button><button class="btn red sm" data-act="reject" data-id="${s.id}">${L('Reject', 'Ablehnen')}</button></div>` : ''}</div>`;
  if (s.status === 'rejected') pend = `<div class="banner bad" style="margin-top:14px">${L('This car was not accepted.', 'Dieses Auto wurde nicht angenommen.')}</div>`;
  const commentForm = banned()
    ? `<div class="banner bad">${L('Your account is suspended after three warnings. You can read, but not comment.', 'Dein Konto ist nach drei Verwarnungen gesperrt. Du kannst lesen, aber nicht kommentieren.')}</div>`
    : s.status !== 'approved' ? '' : `<form data-form="comment" class="stack" style="margin:12px 0 6px"><input type="hidden" name="parent" value=""><div id="replyto" class="replyto" hidden><span></span><button type="button" class="linkb sm" data-act="cancelreply">${L('Cancel', 'Abbrechen')}</button></div><label class="sr" for="ct">${L('Your comment', 'Dein Kommentar')}</label><textarea id="ct" name="text" rows="2" maxlength="400" placeholder="${L('Add a comment. Use @name to mention someone.', 'Kommentar schreiben. Mit @name erwähnst du jemanden.')}"></textarea><div class="row"><button class="btn sm" type="submit">${L('Post comment', 'Kommentar senden')}</button><span class="hint" style="margin:0">${L('Bad language is filtered and earns a warning.', 'Schimpfwörter werden gefiltert und führen zu einer Verwarnung.')}</span></div></form>`;
  const known = d.mentions || {};
  const cmHTML = (c, re) => {
    const au = d.authors[c.user_id];
    const canReply = !!au && s.status === 'approved' && !banned();
    return `<div class="cm${re ? ' re' : ''}" id="c${c.id}">${av(au, re ? 30 : 36)}<div><div class="meta">${uLink(au)} · ${fd(c.created_at)}${c.filtered ? ` · <span class="tag warn">${L('Filtered', 'Gefiltert')}</span>` : ''}</div><p>${mentionHTML(c.body, known)}</p><div class="cacts">${canReply ? `<button class="linkb sm mute" data-act="reply" data-pid="${c.parent_id || c.id}" data-u="${esc(au.username)}">${L('Reply', 'Antworten')}</button>` : ''}${c.user_id !== S.me.id ? `<button class="linkb sm mute" data-act="report" data-k="comment" data-id="${s.id}" data-cid="${c.id}">${L('Report comment', 'Kommentar melden')}</button>` : ''}</div></div></div>`;
  };
  const shownIds = new Set(cs.map(c => c.id));
  const tops = cs.filter(c => !c.parent_id || !shownIds.has(c.parent_id));
  const kids = id => cs.filter(c => c.parent_id === id);
  const thread = c => cmHTML(c, false) + (kids(c.id).length ? `<div class="replies">${kids(c.id).map(k => cmHTML(k, true)).join('')}</div>` : '');
  const comments = S.me
    ? `<h2>${L('Comments', 'Kommentare')} (${cs.length})</h2>${commentForm}
${tops.map(thread).join('')}`
    : `<h2>${L('Comments', 'Kommentare')}</h2><div class="lock">${ic('lock')}<div><p><strong>${L('Comments and full details are for members.', 'Kommentare und alle Details sind für Mitglieder.')}</strong><br>${L('Create a free account to read and write comments and see the full spec.', 'Erstelle ein kostenloses Konto, um Kommentare zu lesen und zu schreiben und alle Daten zu sehen.')}</p><button class="btn sm" data-act="login">${L('Sign in or create account', 'Anmelden oder Konto erstellen')}</button></div></div>`;
  const spUsers = [...new Set(marks.map(x => x.user_id))].map(id => d.authors[id]).filter(Boolean).filter(u => !S.blocked.has(u.id));
  const spotters = spUsers.length ? spUsers.slice(0, 5).map(uLink).join(', ') + (spUsers.length > 5 ? ` ${L(`and ${spUsers.length - 5} more`, `und ${spUsers.length - 5} weitere`)}` : '') : '—';
  const hist = marks.filter(m => !S.blocked.has(m.user_id));
  const timeline = hist.length ? `<div class="card"><h2>${L('Sighting history', 'Sichtungs-Verlauf')}</h2><ol class="tline">${hist.map(m => `<li><time datetime="${esc(m.spotted_on)}">${fd(m.spotted_on)}</time><div><strong>${esc(distLabel(m.district))}</strong><span class="mute sm">${esc(regionName(m.district))} · ${L('spotted by', 'gespottet von')} ${d.authors[m.user_id] ? uLink(d.authors[m.user_id]) : '—'}</span></div></li>`).join('')}</ol></div>` : '';
  const markHint = S.me && s.status === 'approved' && !canEdit ? `<p class="hint" style="margin-top:14px">${L('Seen this car? Mark it as spotted to suggest changes.', 'Dieses Auto gesehen? Markiere es als gespottet, um Änderungen vorzuschlagen.')}</p>` : '';
  const info = `<div class="card"><h2>${L('Information', 'Information')}</h2><dl class="infolist">
<div><dt>${L('Listed in', 'Eingetragen in')}</dt><dd>${s.kind === 'archive' ? `${L('Archive', 'Archiv')}: ${archL(s.arch_kind)}` : L('Registry', 'Register')}</dd></div>
<div><dt>${L('Last spotted', 'Zuletzt gesehen')}</dt><dd>${mem(fd(marks.length ? marks[0].spotted_on : ((d.details && d.details.spotted_on) || s.created_at)))}</dd></div>
<div><dt>${L('Uploaded by', 'Hochgeladen von')}</dt><dd>${mem(uLink(owner))}</dd></div>
<div><dt>${L('Spotted by', 'Gespottet von')}</dt><dd>${mem(spotters)}</dd></div></dl>${markHint}</div>`;
  return `<div class="wrap"><p class="crumb"><a href="${s.kind === 'archive' ? '#archive' : '#cars'}">← ${s.kind === 'archive' ? L('Archive', 'Archiv') : L('Cars', 'Autos')}</a></p>
${gallery}
<div class="carh"><div class="row pl">${plate(s, true)}${s.status === 'pending' ? `<span class="tag warn">${L('Waiting for approval', 'Wartet auf Freigabe')}</span>` : ''}</div>
<h1>${esc(spotName(s))}</h1>${pend}
<p class="loc"><i class="flag" role="img" aria-label="Austria"></i>${esc(distLabel(s.district))}, ${esc(regionName(s.district))}, ${L('Austria', 'Österreich')}</p></div>
<div class="statrow">
<button data-act="like" data-id="${s.id}" aria-pressed="${liked}">${ic('heart')} ${d.likes} ${L('Likes', 'Likes')}</button>
<a class="lk" href="#comments" data-act="tocomments">${ic('chat')} ${cs.length} ${L('Comments', 'Kommentare')}</a>
<button data-act="fav" data-id="${s.id}" aria-pressed="${fav}">${ic('star')} ${fav ? L('Saved', 'Gespeichert') : L('Save', 'Speichern')}</button>
<button data-act="allphotos">${ic('cam')} ${L('All Photos', 'Alle Fotos')} (${n})</button>
<button data-act="share">${ic('share')} ${L('Share', 'Teilen')}</button>
${s.status === 'approved' ? `<button data-act="spotted" data-id="${s.id}" aria-pressed="${myMark}">${ic('pin')} ${myMark ? L('Spotted', 'Gespottet') : L('Mark as spotted', 'Als gespottet markieren')}</button>` : ''}
<span class="sp"></span>
${canEdit ? `<button data-act="edit" data-id="${s.id}">${ic('pen')} ${L('Edit', 'Bearbeiten')}</button>` : ''}
<button data-act="report" data-k="spot" data-id="${s.id}">${ic('flag')} ${L('Report', 'Melden')}</button></div>
<div class="cols"><div>${info}${timeline}<div id="comments" class="card">${comments}</div></div>${panel}</div></div>`;
}

async function pageEvents() {
  const evs = await cached('events', () => api.listEvents());
  const today = new Date().toISOString().slice(0, 10);
  const list = evs.filter(e => e.starts_on >= today);
  const mo = d => new Date(d + 'T12:00:00').toLocaleDateString(S.lang === 'de' ? 'de-AT' : 'en-GB', { month: 'short', year: 'numeric' });
  return head(L('Car events in Austria', 'Auto-Events in Österreich'), L('Meets and shows added by the admin team. Members can’t submit events.', 'Treffen und Shows, eingetragen vom Admin-Team. Events können nicht von Usern eingereicht werden.'))
    + `<div class="wrap"><ul class="evl">${list.length ? list.map(e => `<li><div class="evd"><b>${+e.starts_on.slice(8, 10)}</b><span>${mo(e.starts_on)}</span></div><div><h3>${esc(e.title)}</h3><p class="mute" style="margin:4px 0">${esc([e.place, e.district ? distLabel(e.district) : ''].filter(Boolean).join(' · '))}</p><p>${esc(e.description)}</p></div></li>`).join('') : `<li>${L('No upcoming events yet.', 'Noch keine kommenden Events.')}</li>`}</ul></div>`;
}

async function pageRanking() {
  const us = await cached('rank', () => api.ranking());
  const max = Math.max(1, ...us.map(u => u.uploads));
  return head(L('Top spotters', 'Top-Spotter'), L('Ranked by approved uploads.', 'Gereiht nach freigegebenen Uploads.'))
    + `<div class="wrap"><ol class="rank">${us.length ? us.map((x, i) => `<li><span class="n">${i + 1}</span><div><div class="row" style="gap:8px">${av({ username: x.username }, 30)}<a href="#profile-${esc(x.username)}"><strong>@${esc(x.username)}</strong></a>${x.is_pro ? ' <span class="pro">Pro</span>' : ''}</div><div class="bar"><i style="width:${Math.round(x.uploads / max * 100)}%"></i></div></div><strong>${x.uploads}</strong></li>`).join('') : `<li>${L('No spotters yet.', 'Noch keine Spotter.')}</li>`}</ol></div>`;
}

function pagePro() {
  const perks = [
    [L('Pro badge', 'Pro-Abzeichen'), L('A badge on your profile and next to your name.', 'Ein Abzeichen auf deinem Profil und neben deinem Namen.')],
    [L('Priority review', 'Bevorzugte Prüfung'), L('Your uploads move to the front of the verification queue.', 'Deine Uploads rücken in der Warteschlange nach vorn.')],
    [L('Vienna Archives', 'Vienna Archives'), L('Ex-Viennese cars, visitors from abroad and event cars. Only Pro members can open the archive.', 'Ex-Wiener Autos, Besucher aus dem Ausland und Event-Autos. Nur Pro-Mitglieder können das Archiv öffnen.')],
    [L('No ads', 'Keine Werbung'), L('The registry has no ads by default. If a sponsor ever pays for one, Pro members won’t see it.', 'Das Register hat standardmäßig keine Werbung. Falls ein Sponsor jemals dafür zahlt, sehen Pro-Mitglieder sie nicht.')],
    [L('Plate blurring', 'Kennzeichen unkenntlich machen'), L('Under consideration: automatic blurring of plates in your photos.', 'In Überlegung: automatisches Unkenntlichmachen von Kennzeichen auf deinen Fotos.')]
  ];
  return head('Vienna Car Registry Pro', L('Support the registry and get a few extras. Photos per car stay unlimited for everyone.', 'Unterstütze das Register und bekomm ein paar Extras. Fotos pro Auto bleiben für alle unbegrenzt.'))
    + `<div class="wrap sec"><div style="max-width:860px">${perks.map(p => `<div class="perk"><h3>${p[0]}</h3><p>${p[1]}</p></div>`).join('')}</div>
<div class="row" style="margin-top:26px">${isPro() ? `<span class="pro" style="font-size:15px;padding:6px 12px">${L('You are Pro', 'Du bist Pro')}</span>` : S.me ? `<span class="tag">${L('Not Pro yet', 'Noch nicht Pro')}</span>` : `<button class="btn" data-act="login">${L('Sign in', 'Anmelden')}</button>`}</div>
<p class="hint" style="margin-top:12px">${L('Paid subscriptions are not switched on yet. Until then the team grants Pro by hand. Price to be announced.', 'Bezahlte Abos sind noch nicht freigeschaltet. Bis dahin vergibt das Team Pro von Hand. Preis wird noch bekannt gegeben.')}</p></div>`;
}

async function pageProfile(name) {
  const d = await cached('prof' + name, () => api.profileByUsername(name));
  if (!d) return notFound();
  const p = d.profile, me = !!S.me && S.me.id === p.id;
  const slots = 3 + Math.floor(d.stats.uploads / 5), shown = Math.min(slots, 12);
  const bySlot = {}; d.garage.forEach(g => { bySlot[g.slot] = g.model_id; });
  const firstEmpty = Array.from({ length: slots }, (_, i) => i).find(i => !bySlot[i]);
  let g = '';
  for (let i = 0; i < shown; i++) {
    const mid = bySlot[i];
    if (mid) {
      const m = modelOf(mid);
      g += `<div class="slot full"><small>${esc(m.brand)}</small><span>${esc(m.name)}</span>${me ? `<button data-act="gdel" data-i="${i}" aria-label="${L('Remove', 'Entfernen')}">×</button>` : ''}</div>`;
    } else if (me && i === firstEmpty) {
      g += `<div class="slot"><label class="sr" for="gs">${L('Add a car', 'Auto hinzufügen')}</label><select id="gs" data-gsel="${i}"><option value="">${L('Add a car…', 'Auto hinzufügen …')}</option>${S.models.map(m => `<option value="${esc(m.id)}">${esc(`${m.brand} ${m.name}`)}</option>`).join('')}</select></div>`;
    } else g += `<div class="slot">${L('Empty slot', 'Freier Platz')}</div>`;
  }
  const blockedThem = S.blocked.has(p.id), follow = S.following.has(p.id);
  const spots = d.spots.filter(s => s.kind === 'registry' || isPro() || me);
  let favs = '';
  if (me) {
    const fl = await cached('favs', () => api.listFavorites(S.me.id));
    favs = `<h2 style="margin-top:36px">${L('Saved cars', 'Gespeicherte Autos')}</h2><div class="car_list">${fl.length ? fl.map(tile).join('') : `<p class="mute">${L('Nothing saved yet.', 'Noch nichts gespeichert.')}</p>`}</div>`;
  }
  const actions = me
    ? `<button class="btn ghost sm" data-act="editprofile">${L('Edit profile', 'Profil bearbeiten')}</button><label class="btn ghost sm" style="cursor:pointer">${L('Change photo', 'Foto ändern')}<input type="file" accept="image/*" id="avf" class="sr"></label>`
    : `<button class="btn sm" data-act="follow" data-id="${p.id}" aria-pressed="${follow}">${follow ? L('Following', 'Folge ich') : L('Follow', 'Folgen')}</button><button class="btn ghost sm" data-act="msg" data-id="${p.id}">${L('Message', 'Nachricht')}</button><button class="btn red sm" data-act="block" data-id="${p.id}">${blockedThem ? L('Unblock', 'Entblocken') : L('Block', 'Blockieren')}</button>`;
  return `<div class="wrap"><div class="prof">${av(p, 92)}<div style="flex:1;min-width:240px"><h1 style="font-size:clamp(30px,4vw,44px)">@${esc(p.username)}${p.is_pro ? ' <span class="pro">Pro</span>' : ''}</h1>
<p class="mute" style="margin:8px 0 0">${esc(p.bio)}</p>
<p class="sm mute" style="margin:6px 0 0">${d.stats.uploads} ${L('approved uploads', 'freigegebene Uploads')} · ${d.stats.followers} ${L('followers', 'Follower')}</p></div>
<div class="row">${S.me ? actions : `<button class="btn" data-act="login">${L('Sign in', 'Anmelden')}</button>`}</div></div>
<h2 style="margin-top:12px">Dream Garage</h2>
<p class="mute sm" style="margin:6px 0 14px">${L(`${slots} slots: 3 to start, one more for every 5 approved uploads. Everyone can see it.`, `${slots} Plätze: 3 zum Start, einer mehr pro 5 freigegebenen Uploads. Für alle sichtbar.`)}</p>
<div class="garage">${g}</div>${slots > 12 ? `<p class="hint">${L(`+${slots - 12} more slots unlocked`, `+${slots - 12} weitere Plätze freigeschaltet`)}</p>` : ''}
${badgesHTML(d.badgeStats)}
<h2 style="margin-top:36px">${L('Uploads', 'Uploads')}</h2>
<div class="car_list">${spots.length ? spots.map(s => `<div>${tile(s)}${s.status === 'pending' ? `<span class="tag warn" style="margin-top:6px">${L('Waiting for approval', 'Wartet auf Freigabe')}</span>` : s.status === 'rejected' ? `<span class="tag" style="margin-top:6px">${L('Not accepted', 'Nicht angenommen')}</span>` : ''}</div>`).join('') : `<p class="mute">${L('No uploads yet.', 'Noch keine Uploads.')}</p>`}</div>${favs}</div>`;
}

async function pageMessages() {
  if (!S.me) return gate(L('Messages', 'Nachrichten'), L('Sign in to message other spotters.', 'Melde dich an, um anderen Spottern zu schreiben.'));
  const msgs = await cached('msgs', () => api.listMessages());
  const partner = m => (m.sender_id === S.me.id ? m.recipient_id : m.sender_id);
  const last = {};
  msgs.forEach(m => { last[partner(m)] = m.created_at; });
  let ids = Object.keys(last).sort((a, b) => String(last[b]).localeCompare(String(last[a])));
  if (S.msgWith && S.msgWith !== S.me.id && !ids.includes(S.msgWith)) ids.unshift(S.msgWith);
  const prof = await cached('mp' + ids.join(','), () => api.profilesByIds(ids));
  ids = ids.filter(id => prof[id] && !S.blocked.has(id));
  const cur = ids.includes(S.msgWith) ? S.msgWith : ids[0];
  const thread = msgs.filter(m => partner(m) === cur);
  return head(L('Messages', 'Nachrichten')) + `<div class="wrap"><div class="msgs"><div class="thr">${ids.length ? ids.map(id => `<button data-act="thread" data-id="${id}" ${cur === id ? 'aria-current="true"' : ''}>${av(prof[id], 32)}<span>@${esc(prof[id].username)}</span></button>`).join('') : `<p class="mute">${L('No conversations yet. Open a profile and choose Message.', 'Noch keine Unterhaltungen. Öffne ein Profil und wähle Nachricht.')}</p>`}</div>
<div>${cur ? `<div>${thread.map(m => `<div class="bub${m.sender_id === S.me.id ? ' me' : ''}">${esc(m.body)}</div>`).join('') || `<p class="mute">${L('Say hello.', 'Schreib die erste Nachricht.')}</p>`}</div>
<form data-form="msg" class="row" style="margin-top:14px;flex-wrap:nowrap"><label class="sr" for="mt1">${L('Message', 'Nachricht')}</label><input class="fi" id="mt1" name="text" type="text" maxlength="500" placeholder="${L('Write a message', 'Nachricht schreiben')}" style="flex:1" autocomplete="off"><button class="btn" type="submit">${L('Send', 'Senden')}</button></form>` : ''}</div></div></div>`;
}

const famRadios = sel => Object.keys(COLORS).map(k => `<label><input type="radio" name="color" value="${k}"${sel === k ? ' checked' : ''}><span style="background:${COLORS[k].hex}"></span>${cn(k)}</label>`).join('');
// Lackauswahl: offizielle Herstellernamen des Modells; ohne Liste oder mit "Anderer" zählt die Farbgruppe
function paintPicker(mid, selPaint, selFam, allowOther) {
  if (!mid) return `<p class="hint">${L('Choose a model first. Then you can pick its official paint.', 'Wähle zuerst ein Modell. Dann kannst du den offiziellen Lack wählen.')}</p>`;
  const ps = S.paints[mid] || [], other = allowOther !== false, oth = other && !selPaint;
  const list = ps.map(p => `<label><input type="radio" name="paint" value="${esc(p.name)}"${selPaint === p.name ? ' checked' : ''}><span style="background:${esc(p.hex)}"></span>${esc(p.name)}</label>`).join('');
  const otherOpt = other && ps.length ? `<label><input type="radio" name="paint" value=""${oth ? ' checked' : ''}><span class="sw0"></span>${L('Other / not listed', 'Anderer / nicht gelistet')}</label>` : '';
  const showFam = other && (oth || !ps.length);
  return `<fieldset><legend>${L('Paint', 'Lack')}</legend>${ps.length ? `<div class="swr paints">${list}${otherOpt}</div>` : `<p class="hint">${L('No official paint list for this model yet. Choose the closest colour.', 'Für dieses Modell gibt es noch keine offizielle Lackliste. Wähle die nächste Farbe.')}</p>`}<div id="famwrap" class="swr"${showFam ? '' : ' hidden'}>${famRadios(selFam)}</div></fieldset>`;
}
function pickColor(mid, v) {
  const name = String(v.get('paint') || '');
  if (name) { const r = (S.paints[mid] || []).find(x => x.name === name); return r ? { color: r.family, paint: r.name } : { err: 1 }; }
  const c = v.get('color');
  return c && COLORS[c] ? { color: c, paint: null } : { err: 1 };
}
// Bezirke nach Bundesland gruppiert; nur aktive Bundesländer (und das des gewählten Bezirks)
const distOpts = sel => GEO.regions.filter(r => r.active || regionOf(sel) === r.id)
  .map(r => `<optgroup label="${esc(r.name)}">${GEO.districts.filter(d => d.region_id === r.id).map(d => `<option value="${d.id}"${sel === d.id ? ' selected' : ''}>${esc(distLabel(d.id))}</option>`).join('')}</optgroup>`).join('');
const prevHTML = () => S.up.files.map((f, i) => `<div><img src="${f.url}" alt="${esc(f.file.name)}"><button type="button" data-act="rmphoto" data-i="${i}" aria-label="${L('Remove photo', 'Foto entfernen')}">×</button></div>`).join('');

function pageUpload() {
  if (!S.me) return gate(L('Upload a car', 'Auto hochladen'), L('Create a free account first. You need to be 12 or older.', 'Erstelle zuerst ein kostenloses Konto. Du musst mindestens 12 Jahre alt sein.'));
  if (banned()) return head(L('Uploads paused', 'Uploads pausiert'), L('Your account is suspended after three warnings.', 'Dein Konto ist nach drei Verwarnungen gesperrt.'));
  const k = S.up.kind;
  return head(L('Upload a car', 'Auto hochladen'), L('Every upload is reviewed by an admin before it appears. Pro members are reviewed first.', 'Jeder Upload wird von einem Admin geprüft, bevor er erscheint. Pro-Mitglieder werden zuerst geprüft.'))
    + `<div class="wrap"><form class="form" data-form="upload" novalidate>
<fieldset><legend>${L('What are you uploading?', 'Was lädst du hoch?')}</legend><div class="choice"><label><input type="radio" name="kind" value="registry"${k === 'registry' ? ' checked' : ''}><span>${L('A car seen in Austria', 'Ein Auto in Österreich gesehen')}</span></label><label><input type="radio" name="kind" value="archive"${k === 'archive' ? ' checked' : ''}><span>${L('Archive request', 'Archiv-Anfrage')}</span></label></div>
<p class="hint">${L('Archive: cars that were sold abroad, visited Vienna or showed up at an event.', 'Archiv: Autos, die ins Ausland verkauft wurden, Wien besucht haben oder bei einem Event waren.')}</p></fieldset>
<div id="archkind" ${k === 'archive' ? '' : 'hidden'}><label for="ak">${L('Archive type', 'Archiv-Art')}</label><select id="ak" name="arch"><option value="ex">${archL('ex')}</option><option value="visit">${archL('visit')}</option><option value="event">${archL('event')}</option></select></div>
<div><label for="um">${L('Model', 'Modell')}</label><select id="um" name="model" required><option value="">${L('Choose a model', 'Modell wählen')}</option>${S.models.map(m => `<option value="${esc(m.id)}">${esc(`${m.brand} ${m.name}`)}</option>`).join('')}</select>
<p class="hint">${L('Model missing?', 'Modell fehlt?')} <button type="button" class="linkb" data-act="reqmodel">${L('Request it', 'Anfragen')}</button></p></div>
<div id="paintpick">${paintPicker('', '', '')}</div>
<div><label for="ud">${L('District', 'Bezirk')}</label><select id="ud" name="district"><option value="">${L('Choose a district', 'Bezirk wählen')}</option>${distOpts(0)}</select><p class="hint">${L('Only the district is shown, never the exact location.', 'Es wird nur der Bezirk angezeigt, nie der genaue Ort.')}</p></div>
<div><label for="up">${L('Production number (optional)', 'Produktionsnummer (optional)')}</label><input id="up" name="prod" type="text" inputmode="numeric" maxlength="4" placeholder="123"><p class="hint">${L('For example 123 of 500.', 'Zum Beispiel Nr. 123 von 500.')}</p></div>
<div><label for="files">${L('Photos', 'Fotos')}</label><input id="files" type="file" accept="image/*" multiple><p class="hint">${L('As many as you like. More angles are better.', 'So viele du willst. Mehr Blickwinkel sind besser.')}</p><div class="prev" id="prev">${prevHTML()}</div><p class="err" id="uerr">${esc(S.errUp)}</p></div>
<div class="row"><button class="btn" id="usend" type="submit">${L('Send for review', 'Zur Prüfung senden')}</button><span class="prog" id="uprog"></span></div></form></div>`;
}

function pageApply() {
  if (!S.me) return gate(L('Become an admin', 'Admin werden'), L('Sign in to apply.', 'Melde dich an, um dich zu bewerben.'));
  if (S.applied) return head(L('Application sent', 'Bewerbung gesendet'), L('The CEO reads every application. You’ll get a notification when there is a decision.', 'Der CEO liest jede Bewerbung. Du bekommst eine Benachrichtigung, sobald entschieden ist.'));
  return head(L('Become an admin', 'Admin werden'), L('Admins approve cars and keep the registry accurate. Tell us why you want the role and what you know about cars.', 'Admins geben Autos frei und halten das Register korrekt. Sag uns, warum du die Rolle willst und was du über Autos weißt.'))
    + `<div class="wrap"><form class="form" data-form="apply"><div><label for="aw">${L('Why do you want to be an admin?', 'Warum möchtest du Admin werden?')}</label><textarea id="aw" name="why" rows="4" required></textarea><p class="hint">${L('At least 30 characters.', 'Mindestens 30 Zeichen.')}</p></div>
<div><label for="ak2">${L('What do you know about cars?', 'Was weißt du über Autos?')}</label><textarea id="ak2" name="know" rows="4" required></textarea><p class="hint">${L('Models, years, special editions, anything that shows your knowledge.', 'Modelle, Baujahre, Sondereditionen, alles, was dein Wissen zeigt.')}</p></div>
<p class="err" id="aerr"></p><div class="row"><button class="btn" type="submit">${L('Send application', 'Bewerbung senden')}</button></div></form></div>`;
}

/* ---------- Admin ---------- */
const noneYet = () => `<p class="mute" style="padding:24px 0">${L('Nothing waiting. Nice.', 'Nichts offen. Gut so.')}</p>`;
const byPro = (A, a, b) => ((A.authors[b.user_id] || {}).is_pro ? 1 : 0) - ((A.authors[a.user_id] || {}).is_pro ? 1 : 0) || a.id - b.id;
function qSpot(A, s) {
  const u = A.authors[s.user_id];
  return `<div class="qrow"><div class="qthumb">${photoHTML(s, 0)}</div><div class="qmain"><strong>${esc(spotName(s))}</strong> ${u && u.is_pro ? `<span class="pro">Pro · ${L('priority', 'Vorrang')}</span>` : ''}<p class="mute sm">${uLink(u)} · ${esc(distLabel(s.district))} · ${esc(s.paint || cn(s.color))} · ${fd(s.created_at)}${s.kind === 'archive' ? ' · ' + archL(s.arch_kind) : ''}</p></div><div class="qact"><a class="btn ghost sm" href="#car-${s.id}">${L('Open', 'Öffnen')}</a><button class="btn sm" data-act="approve" data-id="${s.id}">${L('Approve', 'Freigeben')}</button><button class="btn red sm" data-act="reject" data-id="${s.id}">${L('Reject', 'Ablehnen')}</button></div></div>`;
}
function paintsAdmin() {
  const fams = Object.keys(COLORS).map(k => `<option value="${k}">${cn(k)}</option>`).join('');
  const form = `<form data-form="paint" class="form" style="padding:18px 0 10px;max-width:560px"><p class="mute sm">${L('Use the official paint name from the manufacturer. The swatch is only an approximation for the picker.', 'Nimm den offiziellen Lacknamen des Herstellers. Die Farbfläche ist nur eine Annäherung für die Auswahl.')}</p>
<div><label for="pm">${L('Model', 'Modell')}</label><select id="pm" name="model">${S.models.map(m => `<option value="${esc(m.id)}">${esc(`${m.brand} ${m.name}`)}</option>`).join('')}</select></div>
<div><label for="pn">${L('Official paint name', 'Offizieller Lackname')}</label><input id="pn" name="name" type="text" maxlength="60" placeholder="Rosso Corsa" required></div>
<div class="row"><div style="flex:1;min-width:150px"><label for="pf">${L('Colour family', 'Farbgruppe')}</label><select id="pf" name="family">${fams}</select></div><div style="flex:1;min-width:150px"><label for="phx">${L('Swatch (hex)', 'Farbfläche (Hex)')}</label><input id="phx" name="hex" type="text" maxlength="7" placeholder="#C8102E" required></div></div>
<p class="err" id="perr2"></p><div class="row"><button class="btn" type="submit">${L('Add paint', 'Lack hinzufügen')}</button></div></form>`;
  const list = S.models.map(m => { const ps = S.paints[m.id] || []; return `<h3 style="margin:22px 0 6px">${esc(`${m.brand} ${m.name}`)}</h3>${ps.length ? ps.map(x => `<div class="qrow"><div class="qmain"><i class="swd" style="background:${esc(x.hex)}"></i><strong>${esc(x.name)}</strong> <span class="mute sm">${cn(x.family)} · ${esc(x.hex)}</span></div><div class="qact"><button class="btn red sm" data-act="paintdel" data-id="${x.id}">${L('Delete', 'Löschen')}</button></div></div>`).join('') : `<p class="mute sm">${L('No official paint list yet. Spotters pick a colour family instead.', 'Noch keine offizielle Lackliste. Spotter wählen stattdessen eine Farbgruppe.')}</p>`}`; }).join('');
  return form + list;
}
function adminBody(A) {
  const t = S.adminTab, sn = id => { const s = A.refSpots.find(x => x.id === id); return s ? spotName(s) : '—'; };
  if (t === 'spots') { const a = A.spots.filter(s => s.kind === 'registry').sort((x, y) => byPro(A, x, y)); return a.length ? a.map(s => qSpot(A, s)).join('') : noneYet(); }
  if (t === 'archive') { const a = A.spots.filter(s => s.kind === 'archive').sort((x, y) => byPro(A, x, y)); return a.length ? a.map(s => qSpot(A, s)).join('') : noneYet(); }
  if (t === 'edits') return A.edits.length ? A.edits.map(e => {
    const s = A.refSpots.find(x => x.id === e.spot_id); if (!s) return '';
    const ch = [];
    if (e.paint) ch.push(`${L('Paint', 'Lack')}: ${esc(s.paint || cn(s.color))} → ${esc(e.paint)}`);
    else if (e.color) ch.push(`${L('Colour', 'Farbe')}: ${cn(s.color)} → ${cn(e.color)}`);
    if (e.district) ch.push(`${L('District', 'Bezirk')}: ${esc(distLabel(s.district))} → ${esc(distLabel(e.district))}`);
    if (e.prod_no) ch.push(`${L('Production no.', 'Produktionsnr.')}: → ${esc(e.prod_no)}`);
    if (e.arch_kind) ch.push(`${L('Archive request', 'Archiv-Anfrage')}: ${archL(e.arch_kind)}`);
    return `<div class="qrow"><div class="qmain"><strong>${esc(spotName(s))}</strong> · <a href="#car-${s.id}">${L('Open', 'Öffnen')}</a><p class="sm">${ch.join('<br>')}</p><p class="mute sm">${L('Suggested by', 'Vorgeschlagen von')} ${uLink(A.authors[e.user_id])}</p></div><div class="qact"><button class="btn sm" data-act="editok" data-id="${e.id}">${L('Approve', 'Freigeben')}</button><button class="btn red sm" data-act="editno" data-id="${e.id}">${L('Reject', 'Ablehnen')}</button></div></div>`;
  }).join('') : noneYet();
  if (t === 'models') return A.models.length ? A.models.map(r => `<div class="qrow"><div class="qmain"><strong>${esc(r.text)}</strong><p class="mute sm">${L('Requested by', 'Angefragt von')} ${uLink(A.authors[r.user_id])}. ${L('Only exclusive cars belong in the registry.', 'Ins Register gehören nur exklusive Autos.')}</p></div><div class="qact"><button class="btn sm" data-act="modelok" data-id="${r.id}" data-t="${esc(r.text)}">${L('Add model', 'Modell aufnehmen')}</button><button class="btn red sm" data-act="modelno" data-id="${r.id}">${L('Decline', 'Ablehnen')}</button></div></div>`).join('') : noneYet();
  if (t === 'reports') return A.reports.length ? A.reports.map(r => {
    const c = r.comment_id ? A.refComments.find(x => x.id === r.comment_id) : null;
    return `<div class="qrow"><div class="qmain"><strong>${r.comment_id ? L('Comment', 'Kommentar') : L('Car', 'Auto')}: <a href="#car-${r.spot_id}">${esc(sn(r.spot_id))}</a></strong><p class="sm">${esc(REASONS[r.reason][S.lang === 'de' ? 1 : 0])}${r.note ? ': ' + esc(r.note) : ''}</p>${c ? `<p class="sm mute">“${esc(c.body)}” — ${uLink(A.authors[c.user_id])}</p>` : ''}<p class="mute sm">${L('Reported by', 'Gemeldet von')} ${uLink(A.authors[r.reporter_id])}</p></div><div class="qact"><button class="btn ghost sm" data-act="repno" data-id="${r.id}">${L('Dismiss', 'Verwerfen')}</button><button class="btn red sm" data-act="repyes" data-id="${r.id}">${r.comment_id ? L('Remove + warn', 'Entfernen + verwarnen') : L('Remove car', 'Auto entfernen')}</button></div></div>`;
  }).join('') : noneYet();
  if (t === 'apps') return (isCeo() ? '' : `<p class="mute sm" style="padding-top:12px">${L('Only the CEO decides on applications.', 'Nur der CEO entscheidet über Bewerbungen.')}</p>`) + (A.apps.length ? A.apps.map(a => `<div class="qrow"><div class="qmain"><strong>${uLink(A.authors[a.user_id])}</strong><p class="sm"><em>${L('Why', 'Warum')}:</em> ${esc(a.why)}</p><p class="sm"><em>${L('Car knowledge', 'Autowissen')}:</em> ${esc(a.knowledge)}</p></div>${isCeo() ? `<div class="qact"><button class="btn sm" data-act="appyes" data-id="${a.id}">${L('Accept', 'Annehmen')}</button><button class="btn red sm" data-act="appno" data-id="${a.id}">${L('Decline', 'Ablehnen')}</button></div>` : ''}</div>`).join('') : noneYet());
  if (t === 'users') return A.users.map(u => {
    const st = A.status[u.id] || { warnings: 0, banned: false };
    return `<div class="qrow"><div class="qmain"><strong>${uLink(u)}</strong> ${u.role !== 'member' ? `<span class="tag">${esc(u.role)}</span>` : ''}${st.banned ? ` <span class="tag warn">${L('Suspended', 'Gesperrt')}</span>` : ''}<p class="mute sm">${L('Warnings', 'Verwarnungen')}: ${st.warnings}</p></div><div class="qact"><button class="btn ghost sm" data-act="uact" data-id="${u.id}" data-a="${u.is_pro ? 'pro_off' : 'pro_on'}">${u.is_pro ? L('Remove Pro', 'Pro entziehen') : L('Give Pro', 'Pro geben')}</button>${st.banned || st.warnings ? `<button class="btn ghost sm" data-act="uact" data-id="${u.id}" data-a="unban">${L('Reset warnings', 'Verwarnungen zurücksetzen')}</button>` : ''}${!st.banned && u.role === 'member' ? `<button class="btn red sm" data-act="uact" data-id="${u.id}" data-a="ban">${L('Suspend', 'Sperren')}</button>` : ''}</div></div>`;
  }).join('');
  if (t === 'paints') return paintsAdmin();
  if (t === 'regions') return isCeo() ? `<p class="mute sm" style="padding:12px 0 4px">${L('Only active states accept new cars and sightings. Cars already listed stay visible.', 'Nur in aktiven Bundesländern kann man neue Autos und Sichtungen eintragen. Bereits eingetragene Autos bleiben sichtbar.')}</p>${GEO.regions.map(r => { const n = GEO.districts.filter(x => x.region_id === r.id).length; return `<div class="qrow"><div class="qmain"><strong>${esc(r.name)}</strong> ${r.active ? `<span class="tag ok">${L('Active', 'Aktiv')}</span>` : `<span class="tag">${L('Not open yet', 'Noch nicht offen')}</span>`}<p class="mute sm">${n} ${r.id === 'wien' ? L('districts', 'Bezirke') : L('districts and cities', 'Bezirke und Städte')}</p></div><div class="qact"><button class="btn ${r.active ? 'ghost' : ''} sm" data-act="regiontoggle" data-id="${esc(r.id)}" data-on="${r.active ? '' : '1'}">${r.active ? L('Close', 'Sperren') : L('Open', 'Freischalten')}</button></div></div>`; }).join('')}` : '';
  if (t === 'events') return `<form data-form="event" class="form" style="padding:18px 0 10px;max-width:560px"><div><label for="et">${L('Title', 'Titel')}</label><input id="et" name="title" type="text" required></div><div class="row"><div style="flex:1;min-width:150px"><label for="ed">${L('Date', 'Datum')}</label><input id="ed" name="date" type="text" placeholder="2027-04-17" required></div><div style="flex:1;min-width:150px"><label for="edi">${L('District', 'Bezirk')}</label><select id="edi" name="d">${distOpts(1)}</select></div></div><div><label for="ep">${L('Place', 'Ort')}</label><input id="ep" name="place" type="text"></div><div><label for="ex">${L('Description', 'Beschreibung')}</label><textarea id="ex" name="text" rows="2"></textarea></div><p class="err" id="eerr"></p><div class="row"><button class="btn" type="submit">${L('Add event', 'Event hinzufügen')}</button></div></form>${A.events.map(e => `<div class="qrow"><div class="qmain"><strong>${esc(e.title)}</strong><p class="mute sm">${fd(e.starts_on)}${e.district ? ' · ' + esc(distLabel(e.district)) : ''}</p></div><div class="qact"><button class="btn red sm" data-act="evdel" data-id="${e.id}">${L('Delete', 'Löschen')}</button></div></div>`).join('')}`;
  return '';
}
async function pageAdmin() {
  if (!isAdmin()) return head('Admin', L('This area is for admins. Applications are open.', 'Dieser Bereich ist für Admins. Bewerbungen sind offen.')) + `<div class="wrap sec"><a class="btn" href="#apply">${L('Become an admin', 'Admin werden')}</a></div>`;
  const A = await cached('admin', async () => { const a = await api.adminData(); a.events = await api.listEvents(); return a; });
  const cnt = { spots: A.spots.filter(s => s.kind === 'registry').length, archive: A.spots.filter(s => s.kind === 'archive').length, edits: A.edits.length, models: A.models.length, reports: A.reports.length, apps: A.apps.length };
  const tabs = [...(isCeo() ? [['regions', L('States', 'Bundesländer')]] : []), ['spots', L('Cars', 'Autos')], ['edits', L('Edits', 'Änderungen')], ['archive', L('Archive requests', 'Archiv-Anfragen')], ['models', L('Model requests', 'Modell-Anfragen')], ['reports', L('Reports', 'Meldungen')], ['apps', L('Applications', 'Bewerbungen')], ['users', L('People', 'Personen')], ['paints', L('Paints', 'Lacke')], ['events', 'Events']];
  return head('Admin', L('Pro members are listed first in the queue.', 'Pro-Mitglieder stehen zuerst in der Warteschlange.'))
    + `<div class="wrap sec"><div class="tabs" role="group" aria-label="Admin">${tabs.map(t => `<button data-act="atab" data-v="${t[0]}" aria-pressed="${S.adminTab === t[0]}">${t[1]}${cnt[t[0]] != null ? `<em>${cnt[t[0]]}</em>` : ''}</button>`).join('')}</div><div id="abody">${adminBody(A)}</div></div>`;
}

/* ---------- Dialoge ---------- */
function modalHTML() {
  const m = S.modal; if (!m) return '';
  let c = '';
  const x = `<button class="ibtn x" data-act="closeModal" aria-label="${L('Close', 'Schließen')}">×</button>`;
  if (m.t === 'login') {
    const up = S.authTab === 'up';
    c = `<h2 id="mt">${up ? L('Create an account', 'Konto erstellen') : L('Sign in', 'Anmelden')}</h2>
<div class="tabs" role="group"><button type="button" data-act="authtab" data-v="in" aria-pressed="${!up}">${L('Sign in', 'Anmelden')}</button><button type="button" data-act="authtab" data-v="up" aria-pressed="${up}">${L('Create account', 'Konto erstellen')}</button></div>
<form data-form="auth">${OAUTH_PROVIDERS.length ? `<div class="stack">${OAUTH_PROVIDERS.map(p => `<button type="button" class="btn ghost" data-act="oauth" data-p="${esc(p)}">${p === 'google' ? L('Continue with Google', 'Weiter mit Google') : p === 'apple' ? L('Continue with Apple', 'Weiter mit Apple') : esc(p)}</button>`).join('')}</div><div class="divider">${L('or with email', 'oder mit E-Mail')}</div>` : ''}
${up ? `<div><label for="au">${L('Username', 'Benutzername')}</label><input id="au" name="username" type="text" maxlength="20" autocomplete="username" placeholder="ringrunner"><p class="hint">${L('3 to 20 characters: a–z, 0–9, _', '3 bis 20 Zeichen: a–z, 0–9, _')}</p></div>` : ''}
<div><label for="ae">${L('Email', 'E-Mail')}</label><input id="ae" name="email" type="text" inputmode="email" autocomplete="email" required></div>
<div><label for="ap">${L('Password', 'Passwort')}</label><input id="ap" name="password" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" required></div>
${up || OAUTH_PROVIDERS.length ? `<label class="chk"><input type="checkbox" id="age" name="age"><span>${L('I am 12 or older and accept the community rules.', 'Ich bin mindestens 12 Jahre alt und akzeptiere die Community-Regeln.')}</span></label>` : ''}
<p class="err" id="aerr2"></p><p class="okmsg" id="aok"></p>
<button class="btn" type="submit">${up ? L('Create account', 'Konto erstellen') : L('Sign in', 'Anmelden')}</button></form>`;
  }
  if (m.t === 'photos') c = `<h2 id="mt">${L('All photos', 'Alle Fotos')} (${S.carPhotos.length})</h2><div class="allph">${S.carPhotos.map((u, i) => `<button data-act="thumb" data-i="${i}" aria-label="${L('Photo', 'Foto')} ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('')}</div>`;
  if (m.t === 'report') c = `<h2 id="mt">${m.k === 'spot' ? L('Report this car', 'Auto melden') : L('Report this comment', 'Kommentar melden')}</h2>
<form data-form="report"><div><label for="rr">${L('Reason', 'Grund')}</label><select id="rr" name="reason">${Object.keys(REASONS).map(k => `<option value="${k}">${REASONS[k][S.lang === 'de' ? 1 : 0]}</option>`).join('')}</select></div><div><label for="rn">${L('Details (optional)', 'Details (optional)')}</label><textarea id="rn" name="note" rows="3" maxlength="300"></textarea></div><button class="btn" type="submit">${L('Send report', 'Meldung senden')}</button></form>`;
  if (m.t === 'edit') {
    const s = m.spot;
    c = `<h2 id="mt">${L('Suggest changes', 'Änderungen vorschlagen')}</h2><p class="mute sm">${L('Changes go live after an admin approves them.', 'Änderungen gehen online, sobald ein Admin sie freigibt.')}</p>
<form data-form="edit">${paintPicker(s.model_id, s.paint || '', s.color, !s.paint)}<div><label for="ed2">${L('District', 'Bezirk')}</label><select id="ed2" name="district">${distOpts(s.district)}</select></div><div><label for="ep2">${L('Production number', 'Produktionsnummer')}</label><input id="ep2" type="text" name="prod" maxlength="4" value="${esc(m.prod || '')}"></div>
${s.kind === 'registry' ? `<div><label for="ear">${L('Ask to move it to the Vienna Archives', 'Aufnahme in die Vienna Archives anfragen')}</label><select id="ear" name="arch"><option value="">${L('No, keep it in the registry', 'Nein, im Register lassen')}</option><option value="ex">${archL('ex')}</option><option value="visit">${archL('visit')}</option><option value="event">${archL('event')}</option></select></div>` : ''}
<button class="btn" type="submit">${L('Send for approval', 'Zur Freigabe senden')}</button></form>`;
  }
  if (m.t === 'spotted') {
    const t0 = new Date(Date.now() - new Date().getTimezoneOffset() * 60000), day = n => new Date(t0.getTime() - n * 864e5).toISOString().slice(0, 10);
    c = `<h2 id="mt">${L('Mark as spotted', 'Als gespottet markieren')}</h2><p class="mute sm">${L('Where and when did you see this car? Only the district is shown. Afterwards you can suggest changes to its details.', 'Wo und wann hast du dieses Auto gesehen? Es wird nur der Bezirk angezeigt. Danach kannst du Änderungen an den Daten vorschlagen.')}</p>
<form data-form="spotted"><div><label for="sd">${L('District', 'Bezirk')}</label><select id="sd" name="district">${distOpts(m.district)}</select></div><div><label for="so">${L('Date', 'Datum')}</label><input id="so" name="on" type="date" value="${day(0)}" min="${day(29)}" max="${day(0)}" required></div><p class="err" id="serr"></p><button class="btn" type="submit">${L('Mark as spotted', 'Als gespottet markieren')}</button></form>`;
  }
  if (m.t === 'model') c = `<h2 id="mt">${L('Request a model', 'Modell anfragen')}</h2><p class="mute sm">${L('Admins decide. Everyday cars such as a Porsche 911 Carrera are not accepted.', 'Admins entscheiden. Alltägliche Autos wie ein Porsche 911 Carrera werden nicht aufgenommen.')}</p>
<form data-form="model"><div><label for="mq">${L('Brand and model', 'Marke und Modell')}</label><input id="mq" name="text" type="text" maxlength="60" placeholder="Bugatti Chiron" required></div><button class="btn" type="submit">${L('Send request', 'Anfrage senden')}</button></form>`;
  if (m.t === 'profile') c = `<h2 id="mt">${L('Edit profile', 'Profil bearbeiten')}</h2>
<form data-form="profile"><div><label for="pu">${L('Username', 'Benutzername')}</label><input id="pu" name="username" type="text" maxlength="20" value="${esc(S.me.username)}"></div><div><label for="pb">${L('Bio', 'Bio')}</label><textarea id="pb" name="bio" rows="3" maxlength="300">${esc(S.me.bio)}</textarea></div><p class="err" id="perr"></p><button class="btn" type="submit">${L('Save', 'Speichern')}</button></form>`;
  if (m.t === 'modelok') c = `<h2 id="mt">${L('Add model', 'Modell aufnehmen')}</h2><p class="mute sm">${L('Check brand and name. Add the official paints in the Paints tab, and the technical data with its source in Supabase.', 'Prüfe Marke und Namen. Die offiziellen Lacke trägst du im Tab Lacke ein, die technischen Daten mit Quelle in Supabase.')}</p>
<form data-form="modelok"><div><label for="mb">${L('Brand', 'Marke')}</label><input id="mb" name="brand" type="text" value="${esc(m.brand)}" required></div><div><label for="mn">${L('Name', 'Name')}</label><input id="mn" name="name" type="text" value="${esc(m.name)}" required></div><button class="btn" type="submit">${L('Add model', 'Modell aufnehmen')}</button></form>`;
  return `<div class="back" data-act="backdrop"><div class="mod${m.t === 'photos' ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mt">${x}${c}</div></div>`;
}
const openModal = m => { S.modal = m; render(); };
const closeModal = () => { S.modal = null; render(); };
const needLogin = () => { if (S.me) return false; S.authTab = 'in'; openModal({ t: 'login' }); return true; };

/* ---------- Rendern und Routing ---------- */
async function view() {
  switch (S.route) {
    case 'car': return pageCar(S.arg);
    case 'cars': return pageCars();
    case 'archive': return pageArchive();
    case 'events': return pageEvents();
    case 'ranking': return pageRanking();
    case 'upload': return pageUpload();
    case 'pro': return pagePro();
    case 'profile': return pageProfile(S.arg);
    case 'messages': return pageMessages();
    case 'admin': return pageAdmin();
    case 'apply': return pageApply();
    default: return pageHome();
  }
}
async function render() {
  const my = ++S.tok;
  document.documentElement.lang = S.lang; document.documentElement.dataset.theme = S.theme;
  let body;
  try { body = S.configured ? await view() : setupPage(); }
  catch (e) { console.error(e); body = head(L('Could not load this page', 'Diese Seite konnte nicht geladen werden'), esc(errMsg(e))) + `<div class="wrap sec"><button class="btn" data-act="reload">${L('Try again', 'Nochmal versuchen')}</button></div>`; }
  if (my !== S.tok) return;
  const y = window.scrollY;
  $('#app').innerHTML = header() + `<main id="main" tabindex="-1">${body}</main>` + footer() + modalHTML();
  if (S.modal) { const f = $('.mod input:not([type=checkbox]),.mod select,.mod textarea') || $('.mod button'); if (f) f.focus(); }
  window.scrollTo(0, y);
}
function parse() {
  const h = (location.hash || '').slice(1), i = h.indexOf('-');
  const r = i < 0 ? h : h.slice(0, i), a = i < 0 ? '' : decodeURIComponent(h.slice(i + 1));
  const ok = ['home', 'cars', 'car', 'archive', 'events', 'ranking', 'upload', 'pro', 'profile', 'messages', 'admin', 'apply'];
  const nr = ok.includes(r) ? r : 'home';
  if (nr !== S.route || a !== S.arg) S.pi = 0;
  S.route = nr; S.arg = a;
}
function onRoute() {
  parse(); S.notifOpen = false; S.menu = false;
  const main = $('#main'); if (main) main.innerHTML = loadingHTML();
  render().then(() => window.scrollTo(0, 0));
}
const go = h => { if (location.hash === '#' + h) onRoute(); else location.hash = h; };
window.addEventListener('hashchange', onRoute);

async function refreshNotes() { if (S.me) { try { S.notes = await api.listNotes(); } catch (e) { /* ignorieren */ } } }
function resetUserState() { S.msgWith = null; S.applied = false; S.adminTab = 'spots'; S.notifOpen = false; S.up.files.forEach(f => URL.revokeObjectURL(f.url)); S.up = { files: [], kind: 'registry', busy: false }; S.errUp = ''; }
async function refreshMe() {
  const before = S.me && S.me.id;
  const s = await api.session();
  if ((s ? s.user.id : null) !== (before || null)) resetUserState();
  if (!s) { S.me = null; S.status = null; S.likes = new Set(); S.favs = new Set(); S.following = new Set(); S.blocked = new Set(); S.notes = []; S.specs = {}; return; }
  const m = await api.loadMe(s.user.id);
  S.me = m.profile; S.status = m.status;
  S.likes = new Set(m.likes); S.favs = new Set(m.favs); S.following = new Set(m.following); S.blocked = new Set(m.blocked);
  S.specs = await api.loadSpecs().catch(() => ({}));
  await refreshNotes();
}

/* ---------- Aktionen ---------- */
async function after(msg) { bust(); await refreshMe(); if (msg) toast(msg); await render(); }
async function act(a, d, e, el) {
  switch (a) {
    case 'skip': e.preventDefault(); $('#main').focus(); break;
    case 'toreg': e.preventDefault(); $('#reg').scrollIntoView(); break;
    case 'reload': render(); break;
    case 'lang': S.lang = d.v; LS('vcr-lang', S.lang); render(); break;
    case 'theme': S.theme = S.theme === 'dark' ? 'light' : 'dark'; LS('vcr-theme', S.theme); render(); break;
    case 'bell': S.notifOpen = !S.notifOpen; if (S.notifOpen) await refreshNotes(); render(); break;
    case 'readall': await api.markNotesRead(S.me.id); await refreshNotes(); render(); break;
    case 'login': S.authTab = 'in'; openModal({ t: 'login' }); break;
    case 'authtab': S.authTab = d.v; render(); break;
    case 'logout': await api.signOut(); break;
    case 'closeModal': closeModal(); break;
    case 'backdrop': if (e.target === el) closeModal(); break;
    case 'oauth': {
      const age = $('#age'); if (age && !age.checked) { $('#aerr2').textContent = L('Please confirm that you are 12 or older.', 'Bitte bestätige, dass du mindestens 12 Jahre alt bist.'); break; }
      await api.signInOAuth(d.p); break;
    }
    case 'thumb': S.pi = +d.i; S.modal = null; render(); break;
    case 'menu': S.menu = !S.menu; render(); break;
    case 'top': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'hometab': S.homeTab = d.v; render(); break;
    case 'ptab': S.ptab = d.v; render(); break;
    case 'more': S.f.n += 24; render(); break;
    case 'allphotos': if (S.carPhotos.length) openModal({ t: 'photos' }); break;
    case 'share': {
      const u = location.href;
      try { if (navigator.share) await navigator.share({ title: document.title, url: u }); else { await navigator.clipboard.writeText(u); toast(L('Link copied.', 'Link kopiert.')); } }
      catch (err) { if (err && err.name !== 'AbortError') toast(L('Copy the link from the address bar.', 'Kopiere den Link aus der Adresszeile.')); }
      break;
    }
    case 'tocomments': e.preventDefault(); { const c = $('#comments'); if (c) c.scrollIntoView(); } break;
    case 'modelf': { const mm = S.models.find(x => x.id === d.v); S.f = { q: '', brand: mm ? mm.brand : '', model: d.v, color: '', region: '', sort: S.f.sort, n: 24 }; go('cars'); break; }
    case 'like': {
      if (needLogin()) break;
      const id = +d.id, on = !S.likes.has(id); await api.setLike(S.me.id, id, on);
      on ? S.likes.add(id) : S.likes.delete(id); bust(); await render(); break;
    }
    case 'fav': {
      if (needLogin()) break;
      const id = +d.id, on = !S.favs.has(id); await api.setFav(S.me.id, id, on);
      on ? S.favs.add(id) : S.favs.delete(id); bust(); await render(); break;
    }
    case 'spotted': {
      if (needLogin()) break;
      if (banned()) { toast(L('Your account is suspended.', 'Dein Konto ist gesperrt.')); break; }
      const c = await cached('car' + d.id, () => api.getSpot(d.id));
      openModal({ t: 'spotted', id: +d.id, district: c.spot.district, first: !(c.marks || []).some(x => x.user_id === S.me.id) }); break;
    }
    case 'reply': {
      const f = $('form[data-form=comment]'); if (!f) break;
      f.elements.parent.value = d.pid;
      const rt = $('#replyto'); rt.hidden = false; rt.querySelector('span').textContent = L(`Replying to @${d.u}`, `Antwort an @${d.u}`);
      const ta = $('#ct'); if (!ta.value.trim()) ta.value = `@${d.u} `;
      ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); f.scrollIntoView({ block: 'center' }); break;
    }
    case 'cancelreply': { const f = $('form[data-form=comment]'); if (f) { f.elements.parent.value = ''; $('#replyto').hidden = true; } break; }
    case 'report': if (needLogin()) break; openModal({ t: 'report', k: d.k, id: +d.id, cid: d.cid ? +d.cid : null }); break;
    case 'edit': {
      const c = await cached('car' + d.id, () => api.getSpot(d.id));
      openModal({ t: 'edit', id: +d.id, spot: c.spot, prod: c.details && c.details.prod_no }); break;
    }
    case 'reqmodel': openModal({ t: 'model' }); break;
    case 'editprofile': openModal({ t: 'profile' }); break;
    case 'sort': S.f.sort = d.v; S.f.n = 24; render(); break;
    case 'brandf': S.f = { q: '', brand: d.v, model: '', color: '', region: '', sort: S.f.sort, n: 24 }; go('cars'); break;
    case 'colorf': S.f.color = S.f.color === d.v ? '' : d.v; render(); break;
    case 'clear': S.f = { q: '', brand: '', model: '', color: '', region: '', sort: S.f.sort, n: 24 }; render(); break;
    case 'follow': {
      if (needLogin()) break;
      const on = !S.following.has(d.id); await api.setFollow(S.me.id, d.id, on);
      on ? S.following.add(d.id) : S.following.delete(d.id); bust(); await render(); break;
    }
    case 'block': {
      if (needLogin()) break;
      const on = !S.blocked.has(d.id); await api.setBlock(S.me.id, d.id, on);
      if (on) { S.blocked.add(d.id); S.following.delete(d.id); } else S.blocked.delete(d.id);
      bust(); toast(on ? L('Blocked. Their content is hidden.', 'Blockiert. Inhalte werden ausgeblendet.') : L('Unblocked.', 'Entblockt.')); await render(); break;
    }
    case 'msg': if (needLogin()) break; S.msgWith = d.id; go('messages'); break;
    case 'thread': S.msgWith = d.id; render(); break;
    case 'gdel': await api.removeGarage(S.me.id, +d.i); bust(); await render(); break;
    case 'rmphoto': { const f = S.up.files.splice(+d.i, 1)[0]; if (f) URL.revokeObjectURL(f.url); const p = $('#prev'); if (p) p.innerHTML = prevHTML(); break; }
    case 'atab': S.adminTab = d.v; render(); break;
    case 'approve': await api.setSpotStatus(+d.id, 'approved'); await after(L('Approved.', 'Freigegeben.')); break;
    case 'reject': await api.setSpotStatus(+d.id, 'rejected'); bust(); toast(L('Rejected.', 'Abgelehnt.')); if (S.route === 'car') go('admin'); else await render(); break;
    case 'editok': await api.applyEdit(+d.id); await after(L('Edit approved.', 'Änderung freigegeben.')); break;
    case 'editno': await api.rejectEdit(+d.id); await after(); break;
    case 'modelok': openModal({ t: 'modelok', id: +d.id, brand: d.t.split(/\s+/)[0], name: d.t.split(/\s+/).slice(1).join(' ') }); break;
    case 'modelno': await api.declineModelRequest(+d.id); await after(); break;
    case 'repno': await api.resolveReport(+d.id, false); await after(); break;
    case 'repyes': await api.resolveReport(+d.id, true); await after(L('Removed. The author gets a warning where it applies.', 'Entfernt. Der Autor wird gegebenenfalls verwarnt.')); break;
    case 'appyes': await api.decideApplication(+d.id, true); await after(L('Accepted.', 'Angenommen.')); break;
    case 'appno': await api.decideApplication(+d.id, false); await after(); break;
    case 'uact': await api.adminUserAction(d.id, d.a); await after(); break;
    case 'regiontoggle': {
      if (!isCeo()) break;
      await api.setRegionActive(d.id, !!d.on);
      const g = await api.loadGeo(); setGeo(g.regions, g.districts);
      await after(d.on ? L('State opened.', 'Bundesland freigeschaltet.') : L('State closed.', 'Bundesland gesperrt.')); break;
    }
    case 'evdel': await api.deleteEvent(+d.id); await after(); break;
    case 'paintdel': await api.deletePaint(+d.id); S.paints = await api.loadColors(); await after(L('Paint removed.', 'Lack entfernt.')); break;
  }
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) { if (S.notifOpen && !e.target.closest('.notif')) { S.notifOpen = false; render(); } return; }
  if (S.notifOpen && !['bell', 'readall'].includes(el.dataset.act) && !e.target.closest('.notif')) S.notifOpen = false;
  act(el.dataset.act, el.dataset, e, el).catch(err => { console.error(err); toast(errMsg(err)); });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (S.modal) closeModal(); else if (S.notifOpen) { S.notifOpen = false; render(); } } });
document.addEventListener('input', e => {
  if (e.target.id === 'q' && S.route === 'cars') { S.f.q = e.target.value; S.f.n = 24; const g = $('#gridwrap'); if (g) { g.innerHTML = gridHTML(); $('#count').textContent = countText(); } }
});
document.addEventListener('change', e => {
  const t = e.target;
  const run = p => p.catch(err => { console.error(err); toast(errMsg(err)); });
  if (t.id === 'fb') { S.f.brand = t.value; S.f.model = ''; S.f.n = 24; render(); }
  else if (t.id === 'fm') { S.f.model = t.value; S.f.n = 24; render(); }
  else if (t.id === 'fc') { S.f.color = t.value; S.f.n = 24; render(); }
  else if (t.id === 'fr') { S.f.region = t.value; S.f.n = 24; render(); }
  else if (t.name === 'kind') { S.up.kind = t.value; const a = $('#archkind'); if (a) a.hidden = t.value !== 'archive'; }
  else if (t.id === 'um') { const pk = $('#paintpick'); if (pk) pk.innerHTML = paintPicker(t.value, '', ''); }
  else if (t.name === 'paint') { const w = $('#famwrap'); if (w) w.hidden = t.value !== ''; }
  else if (t.id === 'files') {
    [...t.files].filter(f => f.type.indexOf('image/') === 0).forEach(f => S.up.files.push({ file: f, url: URL.createObjectURL(f) }));
    t.value = ''; S.errUp = ''; const p = $('#prev'); if (p) p.innerHTML = prevHTML(); const er = $('#uerr'); if (er) er.textContent = '';
  } else if (t.id === 'avf' && t.files[0]) {
    run(api.uploadAvatar(S.me.id, t.files[0]).then(() => after(L('Photo updated.', 'Foto aktualisiert.'))));
  } else if (t.dataset.gsel !== undefined && t.value) {
    run(api.addGarage(S.me.id, +t.dataset.gsel, t.value).then(() => { bust(); return render(); }));
  }
});
document.addEventListener('submit', e => {
  const f = e.target; if (!f.dataset.form) return; e.preventDefault();
  submit(f).catch(err => { console.error(err); const b = $('#usend'); if (b) { b.disabled = false; } S.up.busy = false; toast(errMsg(err)); });
});

async function submit(f) {
  const v = new FormData(f);
  switch (f.dataset.form) {
    case 'auth': {
      const up = S.authTab === 'up', email = String(v.get('email') || '').trim(), pw = String(v.get('password') || '');
      const er = $('#aerr2'); er.textContent = ''; $('#aok').textContent = '';
      if (!email || !pw) { er.textContent = L('Enter your email and password.', 'Gib E-Mail und Passwort ein.'); return; }
      if (up) {
        const un = String(v.get('username') || '').trim().toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(un)) { er.textContent = L('Username: 3 to 20 characters, a–z, 0–9 and _.', 'Benutzername: 3 bis 20 Zeichen, a–z, 0–9 und _.'); return; }
        if (pw.length < 8) { er.textContent = L('Use at least 8 characters for the password.', 'Nimm mindestens 8 Zeichen für das Passwort.'); return; }
        if (!v.get('age')) { er.textContent = L('Please confirm that you are 12 or older.', 'Bitte bestätige, dass du mindestens 12 Jahre alt bist.'); return; }
        const r = await api.signUp(email, pw, un);
        if (r.session) { S.modal = null; toast(L('Welcome!', 'Willkommen!')); } else $('#aok').textContent = L('Almost done: open the email we sent you and confirm your address. Then sign in.', 'Fast geschafft: Öffne die E-Mail, die wir dir geschickt haben, und bestätige deine Adresse. Danach meldest du dich an.');
      } else { await api.signIn(email, pw); S.modal = null; }
      break;
    }
    case 'search': { S.f = { q: String(v.get('q') || ''), brand: '', model: '', color: '', region: '', sort: S.f.sort, n: 24 }; go('cars'); break; }
    case 'filters': break;
    case 'comment': {
      const body = String(v.get('text') || '').trim(); if (!body) return;
      await api.postComment(+S.arg, S.me.id, body, +v.get('parent') || null);
      await after(); break;
    }
    case 'report': {
      const m = S.modal;
      await api.sendReport({ reporter_id: S.me.id, spot_id: m.id, comment_id: m.cid, reason: v.get('reason'), note: String(v.get('note') || '') });
      S.modal = null; toast(L('Report sent. An admin will look at it.', 'Meldung gesendet. Ein Admin schaut sie sich an.')); await render(); break;
    }
    case 'spotted': {
      const m = S.modal, dd = +v.get('district'), on = String(v.get('on') || ''), er = $('#serr');
      if (!dd) { er.textContent = L('Choose a district.', 'Wähle einen Bezirk.'); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) { er.textContent = L('Choose a date.', 'Wähle ein Datum.'); return; }
      try { await api.markSpotted(S.me.id, m.id, dd, on); }
      catch (err) { er.textContent = err && err.code === '23505' ? L('You already marked this car for that day.', 'Du hast dieses Auto für diesen Tag schon markiert.') : errMsg(err); return; }
      S.modal = null; bust();
      toast(m.first ? L('Marked as spotted. You can now suggest changes.', 'Als gespottet markiert. Du kannst jetzt Änderungen vorschlagen.') : L('Marked as spotted.', 'Als gespottet markiert.')); await render(); break;
    }
    case 'edit': {
      const m = S.modal, s = m.spot, ch = { spot_id: s.id, user_id: S.me.id };
      const pc = pickColor(s.model_id, v), dd = +v.get('district'), p = String(v.get('prod') || '').trim(), ar = String(v.get('arch') || '');
      if (!pc.err) { if (pc.color !== s.color) ch.color = pc.color; if (pc.paint && pc.paint !== s.paint) ch.paint = pc.paint; }
      if (dd !== s.district) ch.district = dd;
      if (p && p !== (m.prod || '')) ch.prod_no = p;
      if (ar) ch.arch_kind = ar;
      S.modal = null;
      if (Object.keys(ch).length === 2) { toast(L('No changes to send.', 'Keine Änderungen zu senden.')); await render(); return; }
      await api.sendEdit(ch); toast(L('Sent. The change appears after approval.', 'Gesendet. Die Änderung erscheint nach Freigabe.')); await render(); break;
    }
    case 'model': {
      const t = String(v.get('text') || '').trim(); if (t.length < 2) return;
      await api.sendModelRequest(S.me.id, t); S.modal = null; toast(L('Request sent. Admins decide.', 'Anfrage gesendet. Admins entscheiden.')); await render(); break;
    }
    case 'modelok': {
      const m = S.modal;
      await api.approveModelRequest(m.id, String(v.get('brand')).trim(), String(v.get('name')).trim());
      S.modal = null; S.models = await api.loadModels(); S.paints = await api.loadColors().catch(() => ({})); await after(L('Model added.', 'Modell aufgenommen.')); break;
    }
    case 'profile': {
      const un = String(v.get('username') || '').trim().toLowerCase(), er = $('#perr');
      if (!/^[a-z0-9_]{3,20}$/.test(un)) { er.textContent = L('Username: 3 to 20 characters, a–z, 0–9 and _.', 'Benutzername: 3 bis 20 Zeichen, a–z, 0–9 und _.'); return; }
      try { await api.updateProfile(S.me.id, { username: un, bio: String(v.get('bio') || '').trim() }); }
      catch (err) { er.textContent = errMsg(err); return; }
      S.modal = null; await after(L('Saved.', 'Gespeichert.'));
      if (S.route === 'profile') go('profile-' + un); break;
    }
    case 'msg': {
      const t = String(v.get('text') || '').trim(); if (!t) return;
      const cur = $('.thr [aria-current=true]'); const to = (cur && cur.dataset.id) || S.msgWith; if (!to) return;
      S.msgWith = to; await api.sendMessage(S.me.id, to, t); bust(); await render(); const i = $('#mt1'); if (i) i.focus(); break;
    }
    case 'upload': {
      if (S.up.busy) return;
      const model = v.get('model'), pc = model ? pickColor(model, v) : { err: 1 }, dist = +v.get('district');
      let err = '';
      if (!model) err = L('Choose a model.', 'Wähle ein Modell.');
      else if (pc.err) err = L('Choose a paint or a colour.', 'Wähle einen Lack oder eine Farbe.');
      else if (!dist) err = L('Choose a district.', 'Wähle einen Bezirk.');
      else if (!S.up.files.length) err = L('Add at least one photo.', 'Füge mindestens ein Foto hinzu.');
      else if (v.get('prod') && !/^\d{1,4}$/.test(String(v.get('prod')).trim())) err = L('The production number must be digits only.', 'Die Produktionsnummer darf nur Ziffern enthalten.');
      if (err) { S.errUp = err; const el = $('#uerr'); el.textContent = err; el.scrollIntoView({ block: 'center' }); return; }
      S.up.busy = true; $('#usend').disabled = true;
      const kind = v.get('kind') === 'archive' ? 'archive' : 'registry';
      await api.uploadSpot(S.me.id, { model_id: model, color: pc.color, paint: pc.paint, district: dist, kind, arch_kind: v.get('arch'), prod_no: String(v.get('prod') || '').trim(), files: S.up.files.map(x => x.file) },
        (i, n) => { const p = $('#uprog'); if (p) p.textContent = L(`Uploading photo ${i} of ${n}…`, `Foto ${i} von ${n} wird hochgeladen …`); });
      S.up.files = []; S.up.busy = false; S.errUp = '';
      bust(); await refreshNotes(); toast(L('Sent for review.', 'Zur Prüfung gesendet.')); go('profile-' + S.me.username); break;
    }
    case 'paint': {
      const name = String(v.get('name') || '').trim(), hex = String(v.get('hex') || '').trim(), er = $('#perr2');
      if (name.length < 2 || name.length > 60) { er.textContent = L('Enter the paint name (2 to 60 characters).', 'Gib den Lacknamen an (2 bis 60 Zeichen).'); return; }
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) { er.textContent = L('The swatch needs a hex colour like #C8102E.', 'Die Farbfläche braucht einen Hex-Wert wie #C8102E.'); return; }
      try { await api.addPaint({ model_id: v.get('model'), name, family: v.get('family'), hex: hex.toUpperCase() }); }
      catch (err) { er.textContent = errMsg(err); return; }
      S.paints = await api.loadColors(); await after(L('Paint added.', 'Lack hinzugefügt.')); break;
    }
    case 'apply': {
      const w = String(v.get('why') || '').trim(), k = String(v.get('know') || '').trim();
      if (w.length < 30 || k.length < 30) { $('#aerr').textContent = L('Please write at least 30 characters in each field.', 'Bitte schreibe in jedes Feld mindestens 30 Zeichen.'); return; }
      try { await api.sendApplication(S.me.id, w, k); } catch (err) { $('#aerr').textContent = err.code === '23505' ? L('You have already applied.', 'Du hast dich schon beworben.') : errMsg(err); return; }
      S.applied = true; await render(); break;
    }
    case 'event': {
      const t = String(v.get('title') || '').trim(), dt = String(v.get('date') || '').trim();
      if (t.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(dt) || isNaN(new Date(dt + 'T12:00:00'))) { $('#eerr').textContent = L('Add a title and a date like 2027-04-17.', 'Gib einen Titel und ein Datum wie 2027-04-17 an.'); return; }
      await api.addEvent({ title: t, starts_on: dt, place: String(v.get('place') || '').trim(), district: +v.get('d') || null, description: String(v.get('text') || '').trim() });
      await after(L('Event added.', 'Event hinzugefügt.')); break;
    }
  }
}

/* ---------- Start ---------- */
async function init() {
  document.documentElement.dataset.theme = S.theme;
  parse();
  try { S.configured = await api.connect(); } catch (e) { console.error(e); S.configured = false; }
  if (!S.configured) { render(); return; }
  try {
    try { const g = await api.loadGeo(); if (!g.districts.length) throw new Error('no districts'); setGeo(g.regions, g.districts); } catch (e) { console.warn(e); wienOnly(); }
    S.models = await api.loadModels();
    S.paints = await api.loadColors().catch(() => ({}));
    await refreshMe();
  } catch (e) { console.error(e); }
  api.onAuth((evt, session) => {
    const uid = session && session.user && session.user.id;
    if (evt === 'SIGNED_IN' && S.me && S.me.id === uid) return;           // gleiche Person, nichts neu laden
    if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(evt)) return;
    setTimeout(async () => { try { await refreshMe(); bust(); render(); } catch (err) { console.error(err); } }, 0);
  });
  await render();
  setInterval(async () => { const before = S.notes.filter(n => !n.read).length; await refreshNotes(); if (S.notes.filter(n => !n.read).length !== before) render(); }, 60000);
}
init();
