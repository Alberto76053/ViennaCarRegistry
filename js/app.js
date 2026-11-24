// Vienna Car Registry – Oberfläche
import * as api from './api.js';
import { OAUTH_PROVIDERS } from './config.js';
import { COLORS, BEZ, distLabel, esc, carSVG } from './art.js';

/* ---------- Helfer ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
const pad = n => String(n).padStart(4, '0');

const S = {
  lang: LS('vcr-lang') === 'de' ? 'de' : 'en',
  theme: LS('vcr-theme') || ((window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'),
  configured: false, route: 'home', arg: '', pi: 0, tok: 0,
  me: null, status: null, models: [], specs: {},
  likes: new Set(), favs: new Set(), following: new Set(), blocked: new Set(), notes: [],
  f: { q: '', brand: '', model: '', color: '', sort: 'new' },
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
const modelOf = id => S.models.find(m => m.id === id) || { id, brand: '', name: id, shape: 'wedge' };
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
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>'
};
const ic = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

/* ---------- Bausteine ---------- */
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
function av(p, size) {
  p = p || { username: '?' };
  const sz = size || 36;
  return `<span class="av" style="--s:${sz}px;background:hsl(${hue(p.username)} 42% 40%)">${p.avatar_path ? `<img src="${esc(api.photoUrl(p.avatar_path, 'avatars'))}" alt="">` : esc((p.username || '?')[0].toUpperCase())}</span>`;
}
const uLink = p => p ? `<a href="#profile-${esc(p.username)}">@${esc(p.username)}</a>${p.is_pro ? ' <span class="pro">Pro</span>' : ''}` : '—';
const plate = (s, lg) => `<span class="plate${lg ? ' lg' : ''}"><i></i><b>VCR ${pad(s.id)}</b><i></i></span>`;

function photoHTML(s, i) {
  i = i || 0;
  const url = (s.photos || [])[i];
  if (url) return `<img src="${esc(url)}" alt="${esc(spotName(s))}" loading="lazy">`;
  const m = modelOf(s.model_id);
  return carSVG(COLORS[s.color].hex, m.shape, (s.id + i) % 3, i % 2 === 1, spotName(s));
}
const tile = s => `<a class="tile" href="#car-${s.id}"><div class="ph">${photoHTML(s, 0)}</div><div class="nm">${esc(spotName(s))}</div></a>`;

function header() {
  const nav = [['home', L('Registry', 'Register')], ['archive', L('Archive', 'Archiv')], ['events', 'Events'], ['ranking', 'Ranking']];
  if (isAdmin()) nav.push(['admin', 'Admin']);
  const cur = S.route === 'car' ? 'home' : S.route;
  const unread = S.notes.filter(n => !n.read).length;
  const lock = `<svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2">${IC.lock}</svg>`;
  const links = nav.map(n => `<a href="#${n[0]}"${cur === n[0] ? ' aria-current="page"' : ''}>${n[1]}${n[0] === 'archive' && !isPro() ? lock : ''}</a>`).join('');
  return `<a class="skip" href="#home" data-act="skip">${L('Skip to content', 'Zum Inhalt springen')}</a>
<header class="top"><div class="wrap topg">
<a class="brand" href="#home"><span class="plate"><i></i><b>VCR</b><i></i></span>Vienna Car Registry</a>
<nav class="main-nav" aria-label="Main">${links}</nav>
<div class="tools">
<span class="seg2" role="group" aria-label="Language"><button data-act="lang" data-v="en" aria-pressed="${S.lang === 'en'}">EN</button><button data-act="lang" data-v="de" aria-pressed="${S.lang === 'de'}">DE</button></span>
<button class="ibtn" data-act="theme" aria-label="${L('Switch light/dark mode', 'Hell/Dunkel umschalten')}">${ic(S.theme === 'dark' ? 'sun' : 'moon')}</button>
${S.me ? `<button class="ibtn" data-act="bell" aria-label="${L('Notifications', 'Benachrichtigungen')}" aria-expanded="${S.notifOpen}">${ic('bell')}${unread ? `<span class="dot">${unread}</span>` : ''}</button>
<a class="ibtn" href="#messages" aria-label="${L('Messages', 'Nachrichten')}">${ic('mail')}</a>
<a href="#profile-${esc(S.me.username)}" aria-label="${L('My profile', 'Mein Profil')}">${av(S.me, 38)}</a>`
    : `<button class="btn ghost sm" data-act="login">${L('Sign in', 'Anmelden')}</button>`}
<a class="btn yel sm" href="#upload">${L('Add a spot', 'Spot hinzufügen')}</a>
</div></div>
${S.notifOpen && S.me ? notifPanel() : ''}</header>`;
}
function notifPanel() {
  return `<div class="notif"><div class="row" style="justify-content:space-between;padding:10px 0 4px"><strong>${L('Notifications', 'Benachrichtigungen')}</strong><button class="linkb sm" data-act="readall">${L('Mark all read', 'Alle gelesen')}</button></div><ul>${S.notes.length ? S.notes.map(n => `<li class="${n.read ? '' : 'un'}">${esc(S.lang === 'de' ? n.text_de : n.text_en)}</li>`).join('') : `<li>${L('Nothing yet.', 'Noch nichts.')}</li>`}</ul></div>`;
}
function footer() {
  return `<footer class="foot"><div class="wrap"><span>Vienna Car Registry · ${L('Built by spotters, checked by admins.', 'Von Spottern gebaut, von Admins geprüft.')}</span><span><a href="#pro">Pro</a>${S.me && !isAdmin() ? ` · <a href="#apply">${L('Become an admin', 'Admin werden')}</a>` : ''}${S.me ? ` · <button class="linkb" data-act="logout">${L('Sign out', 'Abmelden')}</button>` : ''}</span></div></footer>`;
}
const head = (t, sub) => `<section class="wrap ph0"><h1 style="font-size:clamp(34px,5vw,56px)">${t}</h1>${sub ? `<p>${sub}</p>` : ''}</section>`;
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
  if (q) a = a.filter(s => (spotName(s) + ' ' + COLORS[s.color].n.join(' ')).toLowerCase().includes(q));
  a = a.slice().sort(f.sort === 'likes' ? (x, y) => (y.likes - x.likes) || (y.id - x.id) : (x, y) => (y.id - x.id));
  return a;
}
function gridHTML() {
  const a = filtered();
  if (!S.list.length) return `<div class="empty"><h2>${L('No spots yet', 'Noch keine Spots')}</h2><p>${L('Be the first to add a car you saw in Vienna.', 'Lade als Erste oder Erster ein Auto hoch, das du in Wien gesehen hast.')}</p><a class="btn" href="#upload">${L('Add a spot', 'Spot hinzufügen')}</a></div>`;
  if (!a.length) return `<div class="empty"><h2>${L('No cars match these filters', 'Keine Autos für diese Filter')}</h2><p>${L('Try another colour or model, or clear the filters.', 'Probiere eine andere Farbe oder ein anderes Modell oder setze die Filter zurück.')}</p><button class="btn ghost" data-act="clear">${L('Clear filters', 'Filter zurücksetzen')}</button></div>`;
  return `<div class="grid">${a.map(tile).join('')}</div>`;
}
const countText = () => { const n = filtered().length; return L(`${n} ${n === 1 ? 'car' : 'cars'}`, `${n} ${n === 1 ? 'Auto' : 'Autos'}`); };

async function pageHome() {
  S.list = await cached('reg', () => api.listSpots('registry'));
  const f = S.f, hero = S.list[0];
  const brands = [...new Set(S.models.map(m => m.brand))];
  const models = S.models.filter(m => !f.brand || m.brand === f.brand);
  const heroImg = hero
    ? `<a class="heroI" href="#car-${hero.id}" aria-label="${esc(spotName(hero))}">${photoHTML(hero, 0)}<span class="cap">${plate(hero)} ${esc(distLabel(hero.district))}</span></a>`
    : `<div class="heroI">${carSVG(COLORS.yellow.hex, 'coupe', 1, false, '')}</div>`;
  return `<section class="hero"><div class="wrap herog"><div>
<h1>${L("Discover Vienna's finest automobiles", 'Entdecke Wiens feinste Automobile')}</h1>
<p class="lead">${L('A community registry of exclusive cars seen in Vienna. Spot one, add it, and an admin checks it before it goes public.', 'Ein Community-Register für exklusive Autos in Wien. Spotte eins, lade es hoch, und ein Admin prüft es, bevor es öffentlich wird.')}</p>
<div class="row"><a class="btn" href="#upload">${L('Add a spot', 'Spot hinzufügen')}</a><a class="btn ghost" href="#reg" data-act="toreg">${L('Browse the registry', 'Register durchsuchen')}</a></div></div>${heroImg}</div></section>
<section class="wrap" id="reg"><div class="filters">
<label class="sr" for="q">${L('Search', 'Suche')}</label><input class="fi" id="q" type="search" placeholder="${L('Search brand, model, colour', 'Marke, Modell, Farbe suchen')}" value="${esc(f.q)}">
<label class="sr" for="fb">${L('Brand', 'Marke')}</label><select class="fi" id="fb"><option value="">${L('All brands', 'Alle Marken')}</option>${brands.map(b => `<option${f.brand === b ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>
<label class="sr" for="fm">${L('Model', 'Modell')}</label><select class="fi" id="fm"><option value="">${L('All models', 'Alle Modelle')}</option>${models.map(m => `<option value="${esc(m.id)}"${f.model === m.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
<label class="sr" for="fs">${L('Sort', 'Sortierung')}</label><select class="fi" id="fs"><option value="new"${f.sort === 'new' ? ' selected' : ''}>${L('Newest first', 'Neueste zuerst')}</option><option value="likes"${f.sort === 'likes' ? ' selected' : ''}>${L('Most liked', 'Meiste Likes')}</option></select>
<div class="swatches" role="group" aria-label="${L('Colour', 'Farbe')}">${Object.keys(COLORS).map(k => `<button class="sw" data-act="colorf" data-v="${k}" style="background:${COLORS[k].hex}" aria-pressed="${f.color === k}" aria-label="${cn(k)}" title="${cn(k)}"></button>`).join('')}</div>
<span class="count" id="count">${countText()}</span></div>
<div id="gridwrap">${gridHTML()}</div></section>`;
}

function lockedArchive() {
  return head('Vienna Archives', L('Ex-Viennese cars, visitors from abroad and event cars. Archive access is part of Pro.', 'Ex-Wiener Autos, Besucher aus dem Ausland und Event-Autos. Der Archiv-Zugang gehört zu Pro.'))
    + `<div class="wrap sec"><div class="row"><a class="btn yel" href="#pro">${L('See Pro', 'Pro ansehen')}</a>${S.me ? '' : `<button class="btn ghost" data-act="login">${L('Sign in', 'Anmelden')}</button>`}</div></div>`;
}
async function pageArchive() {
  if (!isPro()) return lockedArchive();
  const a = (await cached('arc', () => api.listSpots('archive'))).filter(s => !S.blocked.has(s.user_id));
  const grp = k => { const g = a.filter(s => s.arch_kind === k); return g.length ? `<h2>${ARCHG[k][S.lang === 'de' ? 1 : 0]}</h2><div class="grid">${g.map(tile).join('')}</div>` : ''; };
  return head('Vienna Archives', L('Cars that left Vienna, visited it, or showed up at an event.', 'Autos, die Wien verlassen haben, zu Besuch waren oder bei einem Event auftauchten.'))
    + `<div class="wrap sec">${a.length ? grp('ex') + grp('visit') + grp('event') : `<p class="mute">${L('The archive is empty so far.', 'Das Archiv ist noch leer.')}</p>`}</div>`;
}

async function pageCar(id) {
  if (!/^\d+$/.test(id)) return notFound();
  const d = await cached('car' + id, () => api.getSpot(id));
  if (!d) return notFound(true);
  const s = d.spot, m = modelOf(s.model_id);
  s.photos = d.photos;
  const n = Math.max(d.photos.length, 1), pi = Math.min(S.pi, n - 1);
  const owner = d.authors[s.user_id];
  const mine = S.me && S.me.id === s.user_id;
  const sp = S.specs[s.model_id] || {};
  const thumbs = n > 1 ? `<div class="thumbs">${Array.from({ length: n }, (_, i) => `<button data-act="thumb" data-i="${i}" aria-label="${L('Photo', 'Foto')} ${i + 1}" ${i === pi ? 'aria-current="true"' : ''}>${photoHTML(s, i)}</button>`).join('')}</div>` : '';
  const pub = [[L('Colour', 'Farbe'), cn(s.color)], [L('District', 'Bezirk'), esc(distLabel(s.district))]];
  if (s.kind === 'archive') pub.push([L('Archive', 'Archiv'), archL(s.arch_kind)]);
  const dash = v => (v == null || v === '' ? '—' : esc(v));
  const priv = [
    [L('Engine', 'Motor'), dash(sp.engine)], [L('Power', 'Leistung'), dash(sp.power)], [L('Transmission', 'Getriebe'), dash(sp.transmission)],
    [L('Drive', 'Antrieb'), dash(sp.drive)], [L('Year', 'Baujahr'), dash(sp.year)],
    [L('Production no.', 'Produktionsnr.'), d.details && d.details.prod_no ? `${esc(d.details.prod_no)}${sp.production ? ' / ' + sp.production : ''}` : '—'],
    [L('Spotted', 'Gesehen am'), fd((d.details && d.details.spotted_on) || s.created_at)], [L('Spotted by', 'Gespottet von'), uLink(owner)]
  ];
  const rows = r => r.map(x => `<div><dt>${x[0]}</dt><dd>${x[1]}</dd></div>`).join('');
  const liked = S.likes.has(s.id), fav = S.favs.has(s.id);
  const likeCount = d.likes;
  const cs = d.comments.filter(c => !S.blocked.has(c.user_id));
  let pend = '';
  if (s.status === 'pending') pend = `<div class="banner">${isAdmin() && !mine ? L('This spot waits for review.', 'Dieser Spot wartet auf Prüfung.') : L('Only you can see this spot until an admin approves it.', 'Nur du siehst diesen Spot, bis ein Admin ihn freigibt.')}${isAdmin() ? `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="approve" data-id="${s.id}">${L('Approve', 'Freigeben')}</button><button class="btn red sm" data-act="reject" data-id="${s.id}">${L('Reject', 'Ablehnen')}</button></div>` : ''}</div>`;
  if (s.status === 'rejected') pend = `<div class="banner bad">${L('This spot was not accepted.', 'Dieser Spot wurde nicht angenommen.')}</div>`;
  const commentForm = banned()
    ? `<div class="banner bad">${L('Your account is suspended after three warnings. You can read, but not comment.', 'Dein Konto ist nach drei Verwarnungen gesperrt. Du kannst lesen, aber nicht kommentieren.')}</div>`
    : s.status !== 'approved' ? '' : `<form data-form="comment" class="stack" style="margin:12px 0 6px"><label class="sr" for="ct">${L('Your comment', 'Dein Kommentar')}</label><textarea id="ct" name="text" rows="2" maxlength="400" placeholder="${L('Add a comment', 'Kommentar schreiben')}" style="border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:10px 12px;width:100%"></textarea><div class="row"><button class="btn sm" type="submit">${L('Post comment', 'Kommentar senden')}</button><span class="hint" style="margin:0">${L('Bad language is filtered and earns a warning.', 'Schimpfwörter werden gefiltert und führen zu einer Verwarnung.')}</span></div></form>`;
  const comments = S.me
    ? `<h2 style="margin-top:34px">${L('Comments', 'Kommentare')} (${cs.length})</h2>${commentForm}
${cs.map(c => `<div class="cm">${av(d.authors[c.user_id], 36)}<div><div class="meta">${uLink(d.authors[c.user_id])} · ${fd(c.created_at)}${c.filtered ? ` · <span class="tag warn">${L('Filtered', 'Gefiltert')}</span>` : ''}</div><p>${esc(c.body)}</p>${c.user_id !== S.me.id ? `<button class="linkb sm mute" data-act="report" data-k="comment" data-id="${s.id}" data-cid="${c.id}">${L('Report comment', 'Kommentar melden')}</button>` : ''}</div></div>`).join('')}`
    : `<div class="lock">${ic('lock')}<div><p><strong>${L('Comments and full details are for members.', 'Kommentare und alle Details sind für Mitglieder.')}</strong><br>${L('Create a free account to read and write comments and see the full spec.', 'Erstelle ein kostenloses Konto, um Kommentare zu lesen und zu schreiben und alle Daten zu sehen.')}</p><button class="btn sm" data-act="login">${L('Sign in or create account', 'Anmelden oder Konto erstellen')}</button></div></div>`;
  return `<div class="wrap"><p class="sm" style="padding-top:18px;margin:0"><a href="${s.kind === 'archive' ? '#archive' : '#home'}">← ${s.kind === 'archive' ? L('Archive', 'Archiv') : L('Registry', 'Register')}</a></p>
<div class="carg"><div class="gal"><div class="big">${photoHTML(s, pi)}</div>${thumbs}</div>
<div><div class="row" style="margin-bottom:10px">${plate(s, true)}${s.status === 'pending' ? `<span class="tag warn">${L('Waiting for approval', 'Wartet auf Freigabe')}</span>` : ''}</div>
<h1 style="font-size:clamp(32px,4vw,46px)">${esc(spotName(s))}</h1>${pend}
<dl class="facts">${rows(pub)}${S.me ? rows(priv) : ''}</dl>
${S.me ? '' : `<div class="lock">${ic('lock')}<div><p>${L('Engine, transmission, production number and more are visible with an account.', 'Motor, Getriebe, Produktionsnummer und mehr siehst du mit einem Konto.')}</p><button class="btn sm" data-act="login">${L('Sign in', 'Anmelden')}</button></div></div>`}
<div class="row" style="margin-top:20px">
<button class="btn ghost sm" data-act="like" data-id="${s.id}" aria-pressed="${liked}">${ic('heart')} ${likeCount}</button>
<button class="btn ghost sm" data-act="fav" data-id="${s.id}" aria-pressed="${fav}">${ic('star')} ${fav ? L('Saved', 'Gespeichert') : L('Save', 'Speichern')}</button>
${mine ? `<button class="btn ghost sm" data-act="edit" data-id="${s.id}">${ic('pen')} ${L('Edit', 'Bearbeiten')}</button>` : ''}
<button class="btn ghost sm" data-act="report" data-k="spot" data-id="${s.id}">${ic('flag')} ${L('Report', 'Melden')}</button></div>
</div></div>
<div style="max-width:760px;padding-bottom:60px">${comments}</div></div>`;
}

async function pageEvents() {
  const evs = await cached('events', () => api.listEvents());
  const today = new Date().toISOString().slice(0, 10);
  const list = evs.filter(e => e.starts_on >= today);
  const mo = d => new Date(d + 'T12:00:00').toLocaleDateString(S.lang === 'de' ? 'de-AT' : 'en-GB', { month: 'short', year: 'numeric' });
  return head(L('Car events in Vienna', 'Auto-Events in Wien'), L('Meets and shows added by the admin team. Members can’t submit events.', 'Treffen und Shows, eingetragen vom Admin-Team. Events können nicht von Usern eingereicht werden.'))
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
  return head('Vienna Car Registry Pro', L('Support the registry and get a few extras. Photos per spot stay unlimited for everyone.', 'Unterstütze das Register und bekomm ein paar Extras. Fotos pro Spot bleiben für alle unbegrenzt.'))
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
      const m = modelOf(mid), keys = Object.keys(COLORS);
      g += `<div class="slot full">${carSVG(COLORS[keys[(i * 3 + m.name.length) % keys.length]].hex, m.shape, i % 3, i % 2 === 1, `${m.brand} ${m.name}`)}<span>${esc(`${m.brand} ${m.name}`)}</span>${me ? `<button data-act="gdel" data-i="${i}" aria-label="${L('Remove', 'Entfernen')}">×</button>` : ''}</div>`;
    } else if (me && i === firstEmpty) {
      g += `<div class="slot"><label class="sr" for="gs">${L('Add a car', 'Auto hinzufügen')}</label><select id="gs" data-gsel="${i}"><option value="">${L('Add a car…', 'Auto hinzufügen …')}</option>${S.models.map(m => `<option value="${esc(m.id)}">${esc(`${m.brand} ${m.name}`)}</option>`).join('')}</select></div>`;
    } else g += `<div class="slot">${L('Empty slot', 'Freier Platz')}</div>`;
  }
  const blockedThem = S.blocked.has(p.id), follow = S.following.has(p.id);
  const spots = d.spots.filter(s => s.kind === 'registry' || isPro() || me);
  let favs = '';
  if (me) {
    const fl = await cached('favs', () => api.listFavorites(S.me.id));
    favs = `<h2 style="margin-top:36px">${L('Saved cars', 'Gespeicherte Autos')}</h2><div class="grid">${fl.length ? fl.map(tile).join('') : `<p class="mute">${L('Nothing saved yet.', 'Noch nichts gespeichert.')}</p>`}</div>`;
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
<h2 style="margin-top:36px">${L('Spots', 'Spots')}</h2>
<div class="grid">${spots.length ? spots.map(s => `<div>${tile(s)}${s.status === 'pending' ? `<span class="tag warn" style="margin-top:6px">${L('Waiting for approval', 'Wartet auf Freigabe')}</span>` : s.status === 'rejected' ? `<span class="tag" style="margin-top:6px">${L('Not accepted', 'Nicht angenommen')}</span>` : ''}</div>`).join('') : `<p class="mute">${L('No spots yet.', 'Noch keine Spots.')}</p>`}</div>${favs}</div>`;
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

const swatchRadios = sel => Object.keys(COLORS).map(k => `<label><input type="radio" name="color" value="${k}"${sel === k ? ' checked' : ''}><span style="background:${COLORS[k].hex}"></span>${cn(k)}</label>`).join('');
const distOpts = sel => BEZ.map((b, i) => `<option value="${i + 1}"${sel === i + 1 ? ' selected' : ''}>${esc(distLabel(i + 1))}</option>`).join('');
const prevHTML = () => S.up.files.map((f, i) => `<div><img src="${f.url}" alt="${esc(f.file.name)}"><button type="button" data-act="rmphoto" data-i="${i}" aria-label="${L('Remove photo', 'Foto entfernen')}">×</button></div>`).join('');

function pageUpload() {
  if (!S.me) return gate(L('Add a spot', 'Spot hinzufügen'), L('Create a free account first. You need to be 12 or older.', 'Erstelle zuerst ein kostenloses Konto. Du musst mindestens 12 Jahre alt sein.'));
  if (banned()) return head(L('Uploads paused', 'Uploads pausiert'), L('Your account is suspended after three warnings.', 'Dein Konto ist nach drei Verwarnungen gesperrt.'));
  const k = S.up.kind;
  return head(L('Add a spot', 'Spot hinzufügen'), L('Every upload is reviewed by an admin before it appears. Pro members are reviewed first.', 'Jeder Upload wird von einem Admin geprüft, bevor er erscheint. Pro-Mitglieder werden zuerst geprüft.'))
    + `<div class="wrap"><form class="form" data-form="upload" novalidate>
<fieldset><legend>${L('What are you adding?', 'Was möchtest du hinzufügen?')}</legend><div class="choice"><label><input type="radio" name="kind" value="registry"${k === 'registry' ? ' checked' : ''}><span>${L('A car seen in Vienna', 'Ein Auto in Wien gesehen')}</span></label><label><input type="radio" name="kind" value="archive"${k === 'archive' ? ' checked' : ''}><span>${L('Archive request', 'Archiv-Anfrage')}</span></label></div>
<p class="hint">${L('Archive: cars that were sold abroad, visited Vienna or showed up at an event.', 'Archiv: Autos, die ins Ausland verkauft wurden, Wien besucht haben oder bei einem Event waren.')}</p></fieldset>
<div id="archkind" ${k === 'archive' ? '' : 'hidden'}><label for="ak">${L('Archive type', 'Archiv-Art')}</label><select id="ak" name="arch"><option value="ex">${archL('ex')}</option><option value="visit">${archL('visit')}</option><option value="event">${archL('event')}</option></select></div>
<div><label for="um">${L('Model', 'Modell')}</label><select id="um" name="model" required><option value="">${L('Choose a model', 'Modell wählen')}</option>${S.models.map(m => `<option value="${esc(m.id)}">${esc(`${m.brand} ${m.name}`)}</option>`).join('')}</select>
<p class="hint">${L('Model missing?', 'Modell fehlt?')} <button type="button" class="linkb" data-act="reqmodel">${L('Request it', 'Anfragen')}</button></p></div>
<fieldset><legend>${L('Colour', 'Farbe')}</legend><div class="swr">${swatchRadios('')}</div></fieldset>
<div><label for="ud">${L('District', 'Bezirk')}</label><select id="ud" name="district"><option value="">${L('Choose a district', 'Bezirk wählen')}</option>${distOpts(0)}</select><p class="hint">${L('Only the district is shown, never the exact spot.', 'Es wird nur der Bezirk angezeigt, nie der genaue Ort.')}</p></div>
<div><label for="up">${L('Production number (optional)', 'Produktionsnummer (optional)')}</label><input id="up" name="prod" type="text" inputmode="numeric" maxlength="4" placeholder="123"><p class="hint">${L('For example 123 of 500.', 'Zum Beispiel Nr. 123 von 500.')}</p></div>
<div><label for="files">${L('Photos', 'Fotos')}</label><input id="files" type="file" accept="image/*" multiple><p class="hint">${L('As many as you like. More angles are better.', 'So viele du willst. Mehr Blickwinkel sind besser.')}</p><div class="prev" id="prev">${prevHTML()}</div><p class="err" id="uerr">${esc(S.errUp)}</p></div>
<div class="row"><button class="btn" id="usend" type="submit">${L('Send for review', 'Zur Prüfung senden')}</button><span class="prog" id="uprog"></span></div></form></div>`;
}

function pageApply() {
  if (!S.me) return gate(L('Become an admin', 'Admin werden'), L('Sign in to apply.', 'Melde dich an, um dich zu bewerben.'));
  if (S.applied) return head(L('Application sent', 'Bewerbung gesendet'), L('The CEO reads every application. You’ll get a notification when there is a decision.', 'Der CEO liest jede Bewerbung. Du bekommst eine Benachrichtigung, sobald entschieden ist.'));
  return head(L('Become an admin', 'Admin werden'), L('Admins approve spots and keep the registry accurate. Tell us why you want the role and what you know about cars.', 'Admins geben Spots frei und halten das Register korrekt. Sag uns, warum du die Rolle willst und was du über Autos weißt.'))
    + `<div class="wrap"><form class="form" data-form="apply"><div><label for="aw">${L('Why do you want to be an admin?', 'Warum möchtest du Admin werden?')}</label><textarea id="aw" name="why" rows="4" required></textarea><p class="hint">${L('At least 30 characters.', 'Mindestens 30 Zeichen.')}</p></div>
<div><label for="ak2">${L('What do you know about cars?', 'Was weißt du über Autos?')}</label><textarea id="ak2" name="know" rows="4" required></textarea><p class="hint">${L('Models, years, special editions, anything that shows your knowledge.', 'Modelle, Baujahre, Sondereditionen, alles, was dein Wissen zeigt.')}</p></div>
<p class="err" id="aerr"></p><div class="row"><button class="btn" type="submit">${L('Send application', 'Bewerbung senden')}</button></div></form></div>`;
}

/* ---------- Admin ---------- */
const noneYet = () => `<p class="mute" style="padding:24px 0">${L('Nothing waiting. Nice.', 'Nichts offen. Gut so.')}</p>`;
const byPro = (A, a, b) => ((A.authors[b.user_id] || {}).is_pro ? 1 : 0) - ((A.authors[a.user_id] || {}).is_pro ? 1 : 0) || a.id - b.id;
function qSpot(A, s) {
  const u = A.authors[s.user_id];
  return `<div class="qrow"><div class="qthumb">${photoHTML(s, 0)}</div><div class="qmain"><strong>${esc(spotName(s))}</strong> ${u && u.is_pro ? `<span class="pro">Pro · ${L('priority', 'Vorrang')}</span>` : ''}<p class="mute sm">${uLink(u)} · ${esc(distLabel(s.district))} · ${cn(s.color)} · ${fd(s.created_at)}${s.kind === 'archive' ? ' · ' + archL(s.arch_kind) : ''}</p></div><div class="qact"><a class="btn ghost sm" href="#car-${s.id}">${L('Open', 'Öffnen')}</a><button class="btn sm" data-act="approve" data-id="${s.id}">${L('Approve', 'Freigeben')}</button><button class="btn red sm" data-act="reject" data-id="${s.id}">${L('Reject', 'Ablehnen')}</button></div></div>`;
}
function adminBody(A) {
  const t = S.adminTab, sn = id => { const s = A.refSpots.find(x => x.id === id); return s ? spotName(s) : '—'; };
  if (t === 'spots') { const a = A.spots.filter(s => s.kind === 'registry').sort((x, y) => byPro(A, x, y)); return a.length ? a.map(s => qSpot(A, s)).join('') : noneYet(); }
  if (t === 'archive') { const a = A.spots.filter(s => s.kind === 'archive').sort((x, y) => byPro(A, x, y)); return a.length ? a.map(s => qSpot(A, s)).join('') : noneYet(); }
  if (t === 'edits') return A.edits.length ? A.edits.map(e => {
    const s = A.refSpots.find(x => x.id === e.spot_id); if (!s) return '';
    const ch = [];
    if (e.color) ch.push(`${L('Colour', 'Farbe')}: ${cn(s.color)} → ${cn(e.color)}`);
    if (e.district) ch.push(`${L('District', 'Bezirk')}: ${esc(distLabel(s.district))} → ${esc(distLabel(e.district))}`);
    if (e.prod_no) ch.push(`${L('Production no.', 'Produktionsnr.')}: → ${esc(e.prod_no)}`);
    if (e.arch_kind) ch.push(`${L('Archive request', 'Archiv-Anfrage')}: ${archL(e.arch_kind)}`);
    return `<div class="qrow"><div class="qmain"><strong>${esc(spotName(s))}</strong> · <a href="#car-${s.id}">${L('Open', 'Öffnen')}</a><p class="sm">${ch.join('<br>')}</p><p class="mute sm">${L('Suggested by', 'Vorgeschlagen von')} ${uLink(A.authors[e.user_id])}</p></div><div class="qact"><button class="btn sm" data-act="editok" data-id="${e.id}">${L('Approve', 'Freigeben')}</button><button class="btn red sm" data-act="editno" data-id="${e.id}">${L('Reject', 'Ablehnen')}</button></div></div>`;
  }).join('') : noneYet();
  if (t === 'models') return A.models.length ? A.models.map(r => `<div class="qrow"><div class="qmain"><strong>${esc(r.text)}</strong><p class="mute sm">${L('Requested by', 'Angefragt von')} ${uLink(A.authors[r.user_id])}. ${L('Only exclusive cars belong in the registry.', 'Ins Register gehören nur exklusive Autos.')}</p></div><div class="qact"><button class="btn sm" data-act="modelok" data-id="${r.id}" data-t="${esc(r.text)}">${L('Add model', 'Modell aufnehmen')}</button><button class="btn red sm" data-act="modelno" data-id="${r.id}">${L('Decline', 'Ablehnen')}</button></div></div>`).join('') : noneYet();
  if (t === 'reports') return A.reports.length ? A.reports.map(r => {
    const c = r.comment_id ? A.refComments.find(x => x.id === r.comment_id) : null;
    return `<div class="qrow"><div class="qmain"><strong>${r.comment_id ? L('Comment', 'Kommentar') : 'Spot'}: <a href="#car-${r.spot_id}">${esc(sn(r.spot_id))}</a></strong><p class="sm">${esc(REASONS[r.reason][S.lang === 'de' ? 1 : 0])}${r.note ? ': ' + esc(r.note) : ''}</p>${c ? `<p class="sm mute">“${esc(c.body)}” — ${uLink(A.authors[c.user_id])}</p>` : ''}<p class="mute sm">${L('Reported by', 'Gemeldet von')} ${uLink(A.authors[r.reporter_id])}</p></div><div class="qact"><button class="btn ghost sm" data-act="repno" data-id="${r.id}">${L('Dismiss', 'Verwerfen')}</button><button class="btn red sm" data-act="repyes" data-id="${r.id}">${r.comment_id ? L('Remove + warn', 'Entfernen + verwarnen') : L('Remove spot', 'Spot entfernen')}</button></div></div>`;
  }).join('') : noneYet();
  if (t === 'apps') return (isCeo() ? '' : `<p class="mute sm" style="padding-top:12px">${L('Only the CEO decides on applications.', 'Nur der CEO entscheidet über Bewerbungen.')}</p>`) + (A.apps.length ? A.apps.map(a => `<div class="qrow"><div class="qmain"><strong>${uLink(A.authors[a.user_id])}</strong><p class="sm"><em>${L('Why', 'Warum')}:</em> ${esc(a.why)}</p><p class="sm"><em>${L('Car knowledge', 'Autowissen')}:</em> ${esc(a.knowledge)}</p></div>${isCeo() ? `<div class="qact"><button class="btn sm" data-act="appyes" data-id="${a.id}">${L('Accept', 'Annehmen')}</button><button class="btn red sm" data-act="appno" data-id="${a.id}">${L('Decline', 'Ablehnen')}</button></div>` : ''}</div>`).join('') : noneYet());
  if (t === 'users') return A.users.map(u => {
    const st = A.status[u.id] || { warnings: 0, banned: false };
    return `<div class="qrow"><div class="qmain"><strong>${uLink(u)}</strong> ${u.role !== 'member' ? `<span class="tag">${esc(u.role)}</span>` : ''}${st.banned ? ` <span class="tag warn">${L('Suspended', 'Gesperrt')}</span>` : ''}<p class="mute sm">${L('Warnings', 'Verwarnungen')}: ${st.warnings}</p></div><div class="qact"><button class="btn ghost sm" data-act="uact" data-id="${u.id}" data-a="${u.is_pro ? 'pro_off' : 'pro_on'}">${u.is_pro ? L('Remove Pro', 'Pro entziehen') : L('Give Pro', 'Pro geben')}</button>${st.banned || st.warnings ? `<button class="btn ghost sm" data-act="uact" data-id="${u.id}" data-a="unban">${L('Reset warnings', 'Verwarnungen zurücksetzen')}</button>` : ''}${!st.banned && u.role === 'member' ? `<button class="btn red sm" data-act="uact" data-id="${u.id}" data-a="ban">${L('Suspend', 'Sperren')}</button>` : ''}</div></div>`;
  }).join('');
  if (t === 'events') return `<form data-form="event" class="form" style="padding:18px 0 10px;max-width:560px"><div><label for="et">${L('Title', 'Titel')}</label><input id="et" name="title" type="text" required></div><div class="row"><div style="flex:1;min-width:150px"><label for="ed">${L('Date', 'Datum')}</label><input id="ed" name="date" type="text" placeholder="2027-04-17" required></div><div style="flex:1;min-width:150px"><label for="edi">${L('District', 'Bezirk')}</label><select id="edi" name="d">${distOpts(1)}</select></div></div><div><label for="ep">${L('Place', 'Ort')}</label><input id="ep" name="place" type="text"></div><div><label for="ex">${L('Description', 'Beschreibung')}</label><textarea id="ex" name="text" rows="2"></textarea></div><p class="err" id="eerr"></p><div class="row"><button class="btn" type="submit">${L('Add event', 'Event hinzufügen')}</button></div></form>${A.events.map(e => `<div class="qrow"><div class="qmain"><strong>${esc(e.title)}</strong><p class="mute sm">${fd(e.starts_on)}${e.district ? ' · ' + esc(distLabel(e.district)) : ''}</p></div><div class="qact"><button class="btn red sm" data-act="evdel" data-id="${e.id}">${L('Delete', 'Löschen')}</button></div></div>`).join('')}`;
  return '';
}
async function pageAdmin() {
  if (!isAdmin()) return head('Admin', L('This area is for admins. Applications are open.', 'Dieser Bereich ist für Admins. Bewerbungen sind offen.')) + `<div class="wrap sec"><a class="btn" href="#apply">${L('Become an admin', 'Admin werden')}</a></div>`;
  const A = await cached('admin', async () => { const a = await api.adminData(); a.events = await api.listEvents(); return a; });
  const cnt = { spots: A.spots.filter(s => s.kind === 'registry').length, archive: A.spots.filter(s => s.kind === 'archive').length, edits: A.edits.length, models: A.models.length, reports: A.reports.length, apps: A.apps.length };
  const tabs = [['spots', L('Spots', 'Spots')], ['edits', L('Edits', 'Änderungen')], ['archive', L('Archive requests', 'Archiv-Anfragen')], ['models', L('Model requests', 'Modell-Anfragen')], ['reports', L('Reports', 'Meldungen')], ['apps', L('Applications', 'Bewerbungen')], ['users', L('People', 'Personen')], ['events', 'Events']];
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
  if (m.t === 'report') c = `<h2 id="mt">${m.k === 'spot' ? L('Report this spot', 'Spot melden') : L('Report this comment', 'Kommentar melden')}</h2>
<form data-form="report"><div><label for="rr">${L('Reason', 'Grund')}</label><select id="rr" name="reason">${Object.keys(REASONS).map(k => `<option value="${k}">${REASONS[k][S.lang === 'de' ? 1 : 0]}</option>`).join('')}</select></div><div><label for="rn">${L('Details (optional)', 'Details (optional)')}</label><textarea id="rn" name="note" rows="3" maxlength="300"></textarea></div><button class="btn" type="submit">${L('Send report', 'Meldung senden')}</button></form>`;
  if (m.t === 'edit') {
    const s = m.spot;
    c = `<h2 id="mt">${L('Edit your spot', 'Spot bearbeiten')}</h2><p class="mute sm">${L('Changes go live after an admin approves them.', 'Änderungen gehen online, sobald ein Admin sie freigibt.')}</p>
<form data-form="edit"><div><label for="ec">${L('Colour', 'Farbe')}</label><select id="ec" name="color">${Object.keys(COLORS).map(k => `<option value="${k}"${s.color === k ? ' selected' : ''}>${cn(k)}</option>`).join('')}</select></div><div><label for="ed2">${L('District', 'Bezirk')}</label><select id="ed2" name="district">${distOpts(s.district)}</select></div><div><label for="ep2">${L('Production number', 'Produktionsnummer')}</label><input id="ep2" type="text" name="prod" maxlength="4" value="${esc(m.prod || '')}"></div>
${s.kind === 'registry' ? `<div><label for="ear">${L('Ask to move it to the Vienna Archives', 'Aufnahme in die Vienna Archives anfragen')}</label><select id="ear" name="arch"><option value="">${L('No, keep it in the registry', 'Nein, im Register lassen')}</option><option value="ex">${archL('ex')}</option><option value="visit">${archL('visit')}</option><option value="event">${archL('event')}</option></select></div>` : ''}
<button class="btn" type="submit">${L('Send for approval', 'Zur Freigabe senden')}</button></form>`;
  }
  if (m.t === 'model') c = `<h2 id="mt">${L('Request a model', 'Modell anfragen')}</h2><p class="mute sm">${L('Admins decide. Everyday cars such as a Porsche 911 Carrera are not accepted.', 'Admins entscheiden. Alltägliche Autos wie ein Porsche 911 Carrera werden nicht aufgenommen.')}</p>
<form data-form="model"><div><label for="mq">${L('Brand and model', 'Marke und Modell')}</label><input id="mq" name="text" type="text" maxlength="60" placeholder="Bugatti Chiron" required></div><button class="btn" type="submit">${L('Send request', 'Anfrage senden')}</button></form>`;
  if (m.t === 'profile') c = `<h2 id="mt">${L('Edit profile', 'Profil bearbeiten')}</h2>
<form data-form="profile"><div><label for="pu">${L('Username', 'Benutzername')}</label><input id="pu" name="username" type="text" maxlength="20" value="${esc(S.me.username)}"></div><div><label for="pb">${L('Bio', 'Bio')}</label><textarea id="pb" name="bio" rows="3" maxlength="300">${esc(S.me.bio)}</textarea></div><p class="err" id="perr"></p><button class="btn" type="submit">${L('Save', 'Speichern')}</button></form>`;
  if (m.t === 'modelok') c = `<h2 id="mt">${L('Add model', 'Modell aufnehmen')}</h2><p class="mute sm">${L('Check brand and name. Technical data can be added later in Supabase.', 'Prüfe Marke und Namen. Technische Daten kannst du später in Supabase ergänzen.')}</p>
<form data-form="modelok"><div><label for="mb">${L('Brand', 'Marke')}</label><input id="mb" name="brand" type="text" value="${esc(m.brand)}" required></div><div><label for="mn">${L('Name', 'Name')}</label><input id="mn" name="name" type="text" value="${esc(m.name)}" required></div><div><label for="ms">${L('Shape of the placeholder drawing', 'Form der Platzhalter-Zeichnung')}</label><select id="ms" name="shape"><option value="wedge">wedge</option><option value="coupe">coupe</option><option value="spyder">spyder</option></select></div><button class="btn" type="submit">${L('Add model', 'Modell aufnehmen')}</button></form>`;
  return `<div class="back" data-act="backdrop"><div class="mod" role="dialog" aria-modal="true" aria-labelledby="mt">${x}${c}</div></div>`;
}
const openModal = m => { S.modal = m; render(); };
const closeModal = () => { S.modal = null; render(); };
const needLogin = () => { if (S.me) return false; S.authTab = 'in'; openModal({ t: 'login' }); return true; };

/* ---------- Rendern und Routing ---------- */
async function view() {
  switch (S.route) {
    case 'car': return pageCar(S.arg);
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
  const ok = ['home', 'car', 'archive', 'events', 'ranking', 'upload', 'pro', 'profile', 'messages', 'admin', 'apply'];
  const nr = ok.includes(r) ? r : 'home';
  if (nr !== S.route || a !== S.arg) S.pi = 0;
  S.route = nr; S.arg = a;
}
function onRoute() {
  parse(); S.notifOpen = false;
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
    case 'thumb': S.pi = +d.i; render(); break;
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
    case 'report': if (needLogin()) break; openModal({ t: 'report', k: d.k, id: +d.id, cid: d.cid ? +d.cid : null }); break;
    case 'edit': {
      const c = await cached('car' + d.id, () => api.getSpot(d.id));
      openModal({ t: 'edit', id: +d.id, spot: c.spot, prod: c.details && c.details.prod_no }); break;
    }
    case 'reqmodel': openModal({ t: 'model' }); break;
    case 'editprofile': openModal({ t: 'profile' }); break;
    case 'colorf': S.f.color = S.f.color === d.v ? '' : d.v; render(); break;
    case 'clear': S.f = { q: '', brand: '', model: '', color: '', sort: S.f.sort }; render(); break;
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
    case 'evdel': await api.deleteEvent(+d.id); await after(); break;
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
  if (e.target.id === 'q') { S.f.q = e.target.value; const g = $('#gridwrap'); if (g) { g.innerHTML = gridHTML(); $('#count').textContent = countText(); } }
});
document.addEventListener('change', e => {
  const t = e.target;
  const run = p => p.catch(err => { console.error(err); toast(errMsg(err)); });
  if (t.id === 'fb') { S.f.brand = t.value; S.f.model = ''; render(); }
  else if (t.id === 'fm') { S.f.model = t.value; render(); }
  else if (t.id === 'fs') { S.f.sort = t.value; render(); }
  else if (t.name === 'kind') { S.up.kind = t.value; const a = $('#archkind'); if (a) a.hidden = t.value !== 'archive'; }
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
    case 'comment': {
      const body = String(v.get('text') || '').trim(); if (!body) return;
      await api.postComment(+S.arg, S.me.id, body);
      await after(); break;
    }
    case 'report': {
      const m = S.modal;
      await api.sendReport({ reporter_id: S.me.id, spot_id: m.id, comment_id: m.cid, reason: v.get('reason'), note: String(v.get('note') || '') });
      S.modal = null; toast(L('Report sent. An admin will look at it.', 'Meldung gesendet. Ein Admin schaut sie sich an.')); await render(); break;
    }
    case 'edit': {
      const m = S.modal, s = m.spot, ch = { spot_id: s.id, user_id: S.me.id };
      const c = v.get('color'), dd = +v.get('district'), p = String(v.get('prod') || '').trim(), ar = String(v.get('arch') || '');
      if (c !== s.color) ch.color = c;
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
      await api.approveModelRequest(m.id, String(v.get('brand')).trim(), String(v.get('name')).trim(), String(v.get('shape')));
      S.modal = null; S.models = await api.loadModels(); await after(L('Model added.', 'Modell aufgenommen.')); break;
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
      const model = v.get('model'), color = v.get('color'), dist = +v.get('district');
      let err = '';
      if (!model) err = L('Choose a model.', 'Wähle ein Modell.');
      else if (!color) err = L('Choose a colour.', 'Wähle eine Farbe.');
      else if (!dist) err = L('Choose a district.', 'Wähle einen Bezirk.');
      else if (!S.up.files.length) err = L('Add at least one photo.', 'Füge mindestens ein Foto hinzu.');
      else if (v.get('prod') && !/^\d{1,4}$/.test(String(v.get('prod')).trim())) err = L('The production number must be digits only.', 'Die Produktionsnummer darf nur Ziffern enthalten.');
      if (err) { S.errUp = err; const el = $('#uerr'); el.textContent = err; el.scrollIntoView({ block: 'center' }); return; }
      S.up.busy = true; $('#usend').disabled = true;
      const kind = v.get('kind') === 'archive' ? 'archive' : 'registry';
      await api.uploadSpot(S.me.id, { model_id: model, color, district: dist, kind, arch_kind: v.get('arch'), prod_no: String(v.get('prod') || '').trim(), files: S.up.files.map(x => x.file) },
        (i, n) => { const p = $('#uprog'); if (p) p.textContent = L(`Uploading photo ${i} of ${n}…`, `Foto ${i} von ${n} wird hochgeladen …`); });
      S.up.files = []; S.up.busy = false; S.errUp = '';
      bust(); await refreshNotes(); toast(L('Sent for review.', 'Zur Prüfung gesendet.')); go('profile-' + S.me.username); break;
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
    S.models = await api.loadModels();
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
