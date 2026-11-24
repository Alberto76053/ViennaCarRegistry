import json, re, subprocess, sys, os, uuid
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
ROOT = '/home/claude/viennacarregistry'
PSQL = ['psql','-h','/tmp/pg','-p','54329','-U','postgres','-d','vcr','-q','-At','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
PASSWORDS = {}   # email -> password
CONFIRM = os.environ.get('CONFIRM_EMAIL') == '1'
CONFIG = """export const SUPABASE_URL = 'https://test.supabase.co';
export const SUPABASE_ANON_KEY = 'test-anon-key-test-anon-key-test-anon-key';
export const OAUTH_PROVIDERS = %s;
""" % os.environ.get('PROVIDERS', '[]')

def lit(v):
    if v is None: return 'NULL'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"
def ident(x):
    assert re.fullmatch(r'[a-z_][a-z0-9_]*', x), x
    return '"' + x + '"'
def cols(c):
    if c.strip() == '*': return '*'
    return ','.join(ident(x.strip()) for x in c.split(','))
def where(filters):
    parts = []
    for op, c, v in filters:
        if op == 'eq': parts.append('%s = %s' % (ident(c), lit(v)))
        elif op == 'in': parts.append('%s in (%s)' % (ident(c), ','.join(lit(x) for x in v) or 'NULL'))
    return (' where ' + ' and '.join(parts)) if parts else ''
def run(sql, uid):
    pre = 'begin;\n'
    if uid: pre += "set local request.jwt.claim.sub = %s;\nset local role authenticated;\n" % lit(uid)
    else: pre += "set local role anon;\n"
    p = subprocess.run(PSQL, input=pre + sql + '\ncommit;\n', capture_output=True, text=True)
    if p.returncode != 0:
        m = re.search(r'ERROR:\s+([0-9A-Z]{5}):\s+(.*)', p.stderr)
        return None, {'code': m.group(1) if m else 'XX000', 'message': m.group(2) if m else p.stderr}
    return p.stdout.strip(), None
def super_(sql):
    p = subprocess.run(PSQL, input=sql, capture_output=True, text=True)
    if p.returncode != 0: raise RuntimeError(p.stderr)
    return p.stdout.strip()

def rest(q, uid):
    t = ident(q['table']); op = q['op']; w = where(q['filters'])
    if op == 'select':
        order = (' order by ' + ','.join('%s %s' % (ident(c), 'asc' if a else 'desc') for c, a in q['order'])) if q['order'] else ''
        lim = (' limit %d' % q['limit']) if q['limit'] else ''
        sql = "select coalesce(jsonb_agg(t),'[]'::jsonb) from (select %s from public.%s%s%s%s) t;" % (cols(q['cols']), t, w, order, lim)
    elif op == 'insert':
        rows = q['values'] if isinstance(q['values'], list) else [q['values']]
        keys = list(rows[0].keys())
        vals = ','.join('(' + ','.join(lit(r.get(k)) for k in keys) + ')' for r in rows)
        base = 'insert into public.%s (%s) values %s' % (t, ','.join(ident(k) for k in keys), vals)
        sql = ("with r as (%s returning %s) select coalesce(jsonb_agg(r),'[]'::jsonb) from r;" % (base, cols(q['cols']))) if q['ret'] else base + ';'
    elif op == 'update':
        sets = ','.join('%s = %s' % (ident(k), lit(v)) for k, v in q['values'].items())
        base = 'update public.%s set %s%s' % (t, sets, w)
        sql = ("with r as (%s returning %s) select coalesce(jsonb_agg(r),'[]'::jsonb) from r;" % (base, cols(q['cols']))) if q['ret'] else base + ';'
    elif op == 'delete':
        base = 'delete from public.%s%s' % (t, w)
        sql = ("with r as (%s returning %s) select coalesce(jsonb_agg(r),'[]'::jsonb) from r;" % (base, cols(q['cols']))) if q['ret'] else base + ';'
    out, err = run(sql, uid)
    if err: return {'error': err}
    if not out: return {'data': None}
    data = json.loads(out.splitlines()[-1])
    if q['single']:
        if len(data) == 1: return {'data': data[0]}
        if len(data) == 0 and q['single'] == 'maybe': return {'data': None}
        return {'error': {'code': 'PGRST116', 'message': 'JSON object requested, multiple (or no) rows returned'}}
    return {'data': data}

def make_session(uid, email):
    return {'access_token': 't' + uid, 'user': {'id': uid, 'email': email}}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body, ctype):
        b = body if isinstance(body, bytes) else body.encode()
        self.send_response(code); self.send_header('content-type', ctype); self.send_header('content-length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/js/config.js': return self.send(200, CONFIG, 'application/javascript')
        if path == '/': path = '/index.html'
        f = os.path.normpath(os.path.join(ROOT, path.lstrip('/')))
        if not f.startswith(ROOT) or not os.path.isfile(f): return self.send(404, 'nope', 'text/plain')
        ct = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css'}.get(os.path.splitext(f)[1], 'application/octet-stream')
        self.send(200, open(f, 'rb').read(), ct + '; charset=utf-8' if ct.startswith('text') else ct)
    def do_POST(self):
        n = int(self.headers.get('content-length', 0)); body = json.loads(self.rfile.read(n) or b'{}')
        ep = self.path.split('/__api/')[-1]
        try:
            if ep == 'rest': res = rest(body['q'], body.get('uid'))
            elif ep == 'rpc':
                args = ','.join('%s => %s' % (k, lit(v)) for k, v in (body.get('args') or {}).items())
                out, err = run('select public.%s(%s);' % (ident(body['name']), args), body.get('uid'))
                res = {'error': err} if err else {'data': None}
            elif ep == 'storage':
                out, err = run("insert into storage.objects(bucket_id,name) values (%s,%s);" % (lit(body['bucket']), lit(body['path'])), body.get('uid'))
                res = {'error': {'message': err['message'], 'statusCode': '403'}} if err else {'data': {}}
            elif ep == 'signup':
                email = body['email']
                if email in PASSWORDS: res = {'error': {'message': 'User already registered'}}
                else:
                    uid = str(uuid.uuid4()); PASSWORDS[email] = body['password']
                    meta = json.dumps({'username': body.get('username')})
                    super_("insert into auth.users(id,email,raw_user_meta_data) values (%s,%s,%s::jsonb);" % (lit(uid), lit(email), lit(meta)))
                    res = {'session': make_session(uid, email), 'confirm': CONFIRM}
            elif ep == 'signin':
                email = body['email']
                if PASSWORDS.get(email) != body['password']: res = {'error': {'message': 'Invalid login credentials'}}
                else:
                    uid = super_("select id from auth.users where email=%s;" % lit(email))
                    res = {'session': make_session(uid, email)}
            else: res = {'error': {'message': 'unknown endpoint'}}
        except Exception as e:
            res = {'error': {'message': str(e)}}
        self.send(200, json.dumps(res), 'application/json')

if __name__ == '__main__':
    for email in ['ana@x.at', 'ben@x.at', 'ada@x.at', 'chief@x.at']: PASSWORDS[email] = 'password1'
    ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
