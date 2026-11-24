// Alle Zugriffe auf Supabase an einer Stelle.
// Die Zugriffsregeln selbst stehen in supabase/schema.sql (Row Level Security),
// diese Datei fragt nur an und gibt die Antworten an die Oberfläche weiter.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=7';

export const configured = /^https:\/\/[^/]+\.supabase\.(co|in)\/?$/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20 && !SUPABASE_ANON_KEY.startsWith('DEIN');
let sb = null;

export async function connect() {
  if (!configured) return false;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
  });
  return true;
}

const ok = ({ data, error }) => { if (error) throw error; return data; };
const back = () => location.origin + location.pathname;
export const photoUrl = (path, bucket = 'spot-photos') => `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${path}`;
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

/* ---------- Anmeldung ---------- */
export async function session() { return ok(await sb.auth.getSession()).session; }
export function onAuth(cb) { sb.auth.onAuthStateChange((evt, s) => cb(evt, s)); }
export async function signInOAuth(provider) { return ok(await sb.auth.signInWithOAuth({ provider, options: { redirectTo: back() } })); }
export async function signUp(email, password, username) {
  return ok(await sb.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: back() } }));
}
export async function signIn(email, password) { return ok(await sb.auth.signInWithPassword({ email, password })); }
export async function signOut() { await sb.auth.signOut(); }

/* ---------- Grunddaten ---------- */
export async function loadModels() { return ok(await sb.from('models').select('id,brand,name').order('brand').order('name')); }
export async function loadGeo() {
  const [r, d] = await Promise.all([
    sb.from('regions').select('id,name,sort,active').order('sort'),
    sb.from('districts').select('id,region_id,name,code,sort').order('sort')
  ]);
  return { regions: ok(r), districts: ok(d) };
}
// Bundesland freischalten oder sperren (nur die CEO-Rolle darf das, die Datenbank prüft es)
export async function setRegionActive(id, active) {
  const rows = ok(await sb.from('regions').update({ active }).eq('id', id).select('id'));
  if (!rows.length) throw new Error('permission denied');
}
export async function loadColors() {
  const rows = ok(await sb.from('model_colors').select('*').order('id'));
  const map = {};
  rows.forEach(r => { (map[r.model_id] = map[r.model_id] || []).push(r); });
  return map;
}
export async function addPaint(row) { ok(await sb.from('model_colors').insert(row)); }
export async function deletePaint(id) { ok(await sb.from('model_colors').delete().eq('id', id)); }
export async function loadSpecs() {
  const rows = ok(await sb.from('model_specs').select('*'));
  const map = {};
  rows.forEach(r => { map[r.model_id] = r; });
  return map;
}

export async function loadMe(uid) {
  const [p, st, bl, lk, fv, fl] = await Promise.all([
    sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
    sb.from('user_status').select('*').eq('user_id', uid).maybeSingle(),
    sb.from('blocks').select('blocked_id').eq('blocker_id', uid),
    sb.from('likes').select('spot_id').eq('user_id', uid),
    sb.from('favorites').select('spot_id').eq('user_id', uid),
    sb.from('follows').select('followee_id').eq('follower_id', uid)
  ]);
  return {
    profile: ok(p), status: ok(st),
    blocked: ok(bl).map(r => r.blocked_id), likes: ok(lk).map(r => r.spot_id),
    favs: ok(fv).map(r => r.spot_id), following: ok(fl).map(r => r.followee_id)
  };
}

export async function profilesByIds(ids) {
  ids = [...new Set(ids)].filter(Boolean);
  if (!ids.length) return {};
  const rows = ok(await sb.from('profiles').select('id,username,is_pro,role,avatar_path').in('id', ids));
  const map = {};
  rows.forEach(r => { map[r.id] = r; });
  return map;
}

/* ---------- Spots ---------- */
async function attach(spots, withStats = true) {
  if (!spots.length) return [];
  const ids = spots.map(s => s.id);
  const [ph, st] = await Promise.all([
    sb.from('spot_photos').select('spot_id,path,position').in('spot_id', ids).order('position'),
    withStats ? sb.from('spot_stats').select('*').in('spot_id', ids) : Promise.resolve({ data: [], error: null })
  ]);
  const photos = {}, stats = {};
  ok(ph).forEach(p => { (photos[p.spot_id] = photos[p.spot_id] || []).push(photoUrl(p.path)); });
  ok(st).forEach(x => { stats[x.spot_id] = x; });
  return spots.map(s => ({ ...s, photos: photos[s.id] || [], likes: (stats[s.id] || {}).likes || 0, comments: (stats[s.id] || {}).comments || 0 }));
}

// Auto des Monats: meiste Likes im Monat (die Datenbank liefert die Auswahl)
export async function loadCarOfMonth() {
  const r = ok(await sb.from('car_of_month').select('*').maybeSingle());
  if (!r) return null;
  const spot = (await attach(ok(await sb.from('spots').select('*').eq('id', r.spot_id)), true))[0];
  return spot ? { spot, likes: r.likes, month: r.month_start } : null;
}

export async function listSpots(kind) {
  const spots = ok(await sb.from('spots').select('*').eq('status', 'approved').eq('kind', kind).order('approved_at', { ascending: false }).limit(300));
  return attach(spots);
}

export async function getSpot(id) {
  const s = ok(await sb.from('spots').select('*').eq('id', id).maybeSingle());
  if (!s) return null;
  const [photos, det, st, cm, mk] = await Promise.all([
    sb.from('spot_photos').select('path,position').eq('spot_id', id).order('position'),
    sb.from('spot_details').select('*').eq('spot_id', id).maybeSingle(),
    sb.from('spot_stats').select('*').eq('spot_id', id).maybeSingle(),
    sb.from('comments').select('*').eq('spot_id', id).order('created_at'),
    sb.from('spot_marks').select('user_id,district,spotted_on').eq('spot_id', id).order('spotted_on', { ascending: false })
  ]);
  const comments = ok(cm), marks = ok(mk);
  const authors = await profilesByIds([s.user_id, ...comments.map(c => c.user_id), ...marks.map(m => m.user_id)]);
  // Wer ist mit @name erwähnt? Nur echte Benutzernamen werden später zu Links.
  const names = [...new Set(comments.flatMap(c => [...c.body.matchAll(/(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,20})/g)].map(m => m[1].toLowerCase())))].slice(0, 30);
  const mentions = {};
  if (names.length) ok(await sb.from('profiles').select('username').in('username', names)).forEach(r => { mentions[r.username] = true; });
  const stats = ok(st) || {};
  return {
    spot: s, photos: ok(photos).map(p => photoUrl(p.path)), details: ok(det),
    likes: stats.likes || 0, commentCount: comments.length, comments, marks, authors, mentions
  };
}

export async function listUserSpots(uid) {
  const spots = ok(await sb.from('spots').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(200));
  return attach(spots);
}

export async function listFavorites(uid) {
  const rows = ok(await sb.from('favorites').select('spot_id').eq('user_id', uid));
  if (!rows.length) return [];
  const spots = ok(await sb.from('spots').select('*').in('id', rows.map(r => r.spot_id)));
  return attach(spots);
}

export async function setLike(uid, spotId, on) {
  if (on) ok(await sb.from('likes').insert({ user_id: uid, spot_id: spotId }));
  else ok(await sb.from('likes').delete().eq('user_id', uid).eq('spot_id', spotId));
}
export async function setFav(uid, spotId, on) {
  if (on) ok(await sb.from('favorites').insert({ user_id: uid, spot_id: spotId }));
  else ok(await sb.from('favorites').delete().eq('user_id', uid).eq('spot_id', spotId));
}
export async function setFollow(uid, other, on) {
  if (on) ok(await sb.from('follows').insert({ follower_id: uid, followee_id: other }));
  else ok(await sb.from('follows').delete().eq('follower_id', uid).eq('followee_id', other));
}
export async function setBlock(uid, other, on) {
  if (on) {
    ok(await sb.from('blocks').insert({ blocker_id: uid, blocked_id: other }));
    ok(await sb.from('follows').delete().eq('follower_id', uid).eq('followee_id', other));
  } else ok(await sb.from('blocks').delete().eq('blocker_id', uid).eq('blocked_id', other));
}

export async function postComment(spotId, uid, body, parentId) {
  const row = { spot_id: spotId, user_id: uid, body };
  if (parentId) row.parent_id = parentId;
  ok(await sb.from('comments').insert(row));
}
export async function sendReport(r) { ok(await sb.from('reports').insert(r)); }
export async function sendEdit(e) { ok(await sb.from('spot_edits').insert(e)); }
export async function markSpotted(uid, spotId, district, spottedOn) { ok(await sb.from('spot_marks').insert({ spot_id: spotId, user_id: uid, district, spotted_on: spottedOn })); }
export async function sendModelRequest(uid, text) { ok(await sb.from('model_requests').insert({ user_id: uid, text })); }
export async function sendApplication(uid, why, knowledge) { ok(await sb.from('admin_applications').insert({ user_id: uid, why, knowledge })); }

/* ---------- Fotos verkleinern und hochladen ---------- */
async function shrink(file, max = 1600, quality = 0.85) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', quality));
  } catch (e) {
    return file; // nicht lesbar: Original hochladen (der Server begrenzt auf 8 MB)
  }
}
const ext = b => (b.type === 'image/png' ? 'png' : b.type === 'image/webp' ? 'webp' : 'jpg');

export async function uploadSpot(uid, v, onProgress) {
  const spot = ok(await sb.from('spots').insert({
    user_id: uid, model_id: v.model_id, color: v.color, paint: v.paint, district: v.district,
    kind: v.kind, arch_kind: v.kind === 'archive' ? v.arch_kind : null
  }).select('id').single());
  try {
    ok(await sb.from('spot_details').insert({ spot_id: spot.id, prod_no: v.prod_no || null }));
    const rows = [];
    for (let i = 0; i < v.files.length; i++) {
      const blob = await shrink(v.files[i]);
      const path = `${uid}/${uuid()}.${ext(blob)}`;
      ok(await sb.storage.from('spot-photos').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false }));
      rows.push({ spot_id: spot.id, path, position: i });
      if (onProgress) onProgress(i + 1, v.files.length);
    }
    ok(await sb.from('spot_photos').insert(rows));
  } catch (e) {
    await sb.from('spots').delete().eq('id', spot.id); // halb fertiges Auto wieder entfernen
    throw e;
  }
  return spot.id;
}

/* ---------- Profile ---------- */
export async function profileByUsername(name) {
  const p = ok(await sb.from('profiles').select('*').eq('username', name).maybeSingle());
  if (!p) return null;
  const [stats, garage, spots, badges] = await Promise.all([
    sb.from('profile_stats').select('*').eq('user_id', p.id).maybeSingle(),
    sb.from('garage').select('slot,model_id').eq('user_id', p.id).order('slot'),
    listUserSpots(p.id),
    sb.from('profile_badge_stats').select('*').eq('user_id', p.id).maybeSingle()
  ]);
  return { profile: p, stats: ok(stats) || { uploads: 0, followers: 0 }, garage: ok(garage), spots, badgeStats: ok(badges) };
}

export async function updateProfile(uid, patch) { ok(await sb.from('profiles').update(patch).eq('id', uid)); }

export async function uploadAvatar(uid, file) {
  const blob = await shrink(file, 480, 0.88);
  const path = `${uid}/${uuid()}.${ext(blob)}`;
  ok(await sb.storage.from('avatars').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false }));
  await updateProfile(uid, { avatar_path: path });
}

export async function addGarage(uid, slot, modelId) { ok(await sb.from('garage').insert({ user_id: uid, slot, model_id: modelId })); }
export async function removeGarage(uid, slot) { ok(await sb.from('garage').delete().eq('user_id', uid).eq('slot', slot)); }

export async function ranking() {
  return ok(await sb.from('profile_stats').select('user_id,username,is_pro,uploads').order('uploads', { ascending: false }).order('username').limit(50));
}

/* ---------- Events ---------- */
export async function listEvents() { return ok(await sb.from('events').select('*').order('starts_on')); }
export async function addEvent(e) { ok(await sb.from('events').insert(e)); }
export async function deleteEvent(id) { ok(await sb.from('events').delete().eq('id', id)); }

/* ---------- Benachrichtigungen und Nachrichten ---------- */
export async function listNotes() { return ok(await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)); }
export async function markNotesRead(uid) { ok(await sb.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false)); }
export async function listMessages() { return ok(await sb.from('messages').select('*').order('created_at').limit(500)); }
export async function sendMessage(uid, to, body) { ok(await sb.from('messages').insert({ sender_id: uid, recipient_id: to, body })); }

/* ---------- Admin ---------- */
export async function adminData() {
  const [sp, ed, mr, rp, ap, us, st] = await Promise.all([
    sb.from('spots').select('*').eq('status', 'pending').order('created_at'),
    sb.from('spot_edits').select('*').order('created_at'),
    sb.from('model_requests').select('*').order('created_at'),
    sb.from('reports').select('*').order('created_at'),
    sb.from('admin_applications').select('*').order('created_at'),
    sb.from('profiles').select('id,username,role,is_pro,created_at').order('created_at', { ascending: false }).limit(100),
    sb.from('user_status').select('*')
  ]);
  const spots = await attach(ok(sp), false);
  const edits = ok(ed), reports = ok(rp);
  const needSpots = [...new Set([...edits.map(e => e.spot_id), ...reports.map(r => r.spot_id)])];
  const refSpots = needSpots.length ? ok(await sb.from('spots').select('*').in('id', needSpots)) : [];
  const cids = reports.map(r => r.comment_id).filter(Boolean);
  const refComments = cids.length ? ok(await sb.from('comments').select('*').in('id', cids)) : [];
  const users = ok(us);
  const authors = await profilesByIds([
    ...spots.map(s => s.user_id), ...edits.map(e => e.user_id), ...ok(mr).map(m => m.user_id),
    ...reports.map(r => r.reporter_id), ...ok(ap).map(a => a.user_id), ...refComments.map(c => c.user_id)
  ]);
  const status = {};
  ok(st).forEach(r => { status[r.user_id] = r; });
  return { spots, edits, models: ok(mr), reports, apps: ok(ap), users, status, refSpots, refComments, authors };
}
export async function setSpotStatus(id, status) { ok(await sb.from('spots').update({ status }).eq('id', id)); }
const rpc = async (name, args) => ok(await sb.rpc(name, args));
export const applyEdit = id => rpc('apply_edit', { edit_id: id });
export const rejectEdit = id => rpc('reject_edit', { edit_id: id });
export const approveModelRequest = (id, brand, name) => rpc('approve_model_request', { req_id: id, p_brand: brand, p_name: name });
export const declineModelRequest = id => rpc('decline_model_request', { req_id: id });
export const resolveReport = (id, remove) => rpc('resolve_report', { rep_id: id, remove });
export const decideApplication = (id, accept) => rpc('decide_application', { app_id: id, accept });
export const adminUserAction = (uid, action) => rpc('admin_user_action', { uid, action });
