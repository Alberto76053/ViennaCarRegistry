// Test-Ersatz für @supabase/supabase-js: leitet alle Anfragen an den lokalen Testserver (echte Postgres-DB mit RLS)
const KEY = 'mock-sb-session';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
const save = s => { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); };
const call = async (path, body) => {
  const r = await fetch('/__api/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
};
const listeners = [];
const emit = (evt, s) => listeners.forEach(cb => setTimeout(() => cb(evt, s), 0));

class QB {
  constructor(table) { this.q = { table, op: 'select', cols: '*', filters: [], order: [], limit: null, single: null, values: null, ret: false }; }
  select(c = '*') { if (this.q.op === 'select') this.q.cols = c; else { this.q.ret = true; this.q.cols = c; } return this; }
  insert(v) { this.q.op = 'insert'; this.q.values = v; return this; }
  update(v) { this.q.op = 'update'; this.q.values = v; return this; }
  delete() { this.q.op = 'delete'; return this; }
  eq(c, v) { this.q.filters.push(['eq', c, v]); return this; }
  in(c, v) { this.q.filters.push(['in', c, v]); return this; }
  order(c, o = {}) { this.q.order.push([c, o.ascending !== false]); return this; }
  limit(n) { this.q.limit = n; return this; }
  single() { this.q.single = 'single'; return this; }
  maybeSingle() { this.q.single = 'maybe'; return this; }
  then(res, rej) {
    const s = load();
    return call('rest', { q: this.q, uid: s && s.user.id }).then(r => res({ data: r.data === undefined ? null : r.data, error: r.error || null }), rej);
  }
}

export function createClient(url, key, opts) {
  return {
    from: t => new QB(t),
    rpc: async (name, args) => { const s = load(); const r = await call('rpc', { name, args, uid: s && s.user.id }); return { data: r.data === undefined ? null : r.data, error: r.error || null }; },
    storage: { from: bucket => ({
      upload: async (path, blob, o) => { const s = load(); const r = await call('storage', { bucket, path, uid: s && s.user.id, size: blob.size, type: blob.type }); return { data: r.error ? null : { path }, error: r.error || null }; }
    }) },
    auth: {
      getSession: async () => ({ data: { session: load() }, error: null }),
      onAuthStateChange: cb => { listeners.push(cb); setTimeout(() => cb('INITIAL_SESSION', load()), 0); return { data: { subscription: {} } }; },
      signInWithPassword: async ({ email, password }) => {
        const r = await call('signin', { email, password });
        if (r.error) return { data: { session: null, user: null }, error: r.error };
        save(r.session); emit('SIGNED_IN', r.session); return { data: { session: r.session, user: r.session.user }, error: null };
      },
      signUp: async ({ email, password, options }) => {
        const r = await call('signup', { email, password, username: options && options.data && options.data.username });
        if (r.error) return { data: { session: null, user: null }, error: r.error };
        if (r.confirm) return { data: { session: null, user: r.session.user }, error: null };
        save(r.session); emit('SIGNED_IN', r.session); return { data: { session: r.session, user: r.session.user }, error: null };
      },
      signInWithOAuth: async () => ({ data: {}, error: { message: 'Provider is not enabled' } }),
      signOut: async () => { save(null); emit('SIGNED_OUT', null); return { error: null }; }
    }
  };
}
