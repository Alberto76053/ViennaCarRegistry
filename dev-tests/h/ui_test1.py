import sys, json
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765'
MOCK=open('/home/claude/tools/h/mock_supabase.js').read()
errs=[]
def setup(p, w=1280, h=900):
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':w,'height':h})
    ctx.route('**/cdn.jsdelivr.net/**', lambda r: r.fulfill(body=MOCK, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    ctx.route('**/test.supabase.co/**', lambda r: r.fulfill(body="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'><rect width='3' height='2' fill='#456'/></svg>", content_type='image/svg+xml'))
    pg=ctx.new_page()
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.on('console', lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' and 'fonts' not in m.text and 'ERR_FAILED' not in m.text else None)
    return b,pg
def ok(c,msg):
    print(('PASS ' if c else 'FAIL ')+msg)
    if not c: errs.append('FAIL '+msg)
with sync_playwright() as p:
    b,pg=setup(p)
    pg.goto(BASE+'/#home'); pg.wait_for_selector('.tile')
    ok(pg.locator('.tile').count()==5, 'guest sees 5 approved registry spots (got %d)'%pg.locator('.tile').count())
    ok('VIENNA' in pg.inner_text('h1').upper() and 'Explore' in pg.inner_text('.lead'), 'hero headline')
    # search page with filters
    pg.fill('#q','laferrari'); pg.press('#q','Enter'); pg.wait_for_selector('#gridwrap')
    ok(pg.locator('.tile').count()==1,'hero search opens the search page: laferrari -> 1')
    pg.fill('#q',''); ok(pg.locator('.tile').count()==5,'search cleared -> 5')
    pg.select_option('#fc','blue'); ok(pg.locator('.tile').count()==1,'colour blue -> 1')
    pg.select_option('#fc','')
    # car page as guest
    pg.goto(BASE+'/#car-1'); pg.wait_for_selector('.facts')
    t=pg.inner_text('.facts')
    ok('Engine' not in t and ('Paint' in t or 'Colour' in t) and 'District' in t,'guest: only public facts')
    ok(pg.locator('.lock').count()>=1,'guest: lock box')
    ok(pg.locator('.pill:has-text("Log in")').count()>=1,'guest: members-only rows show a log-in pill')
    ok(pg.locator('.banner_gallery .thumb').count()==2,'gallery has 2 photos (1 large, 1 small)')
    # pending spot not visible to guest
    pg.goto(BASE+'/#car-7'); pg.wait_for_selector('main h1')
    ok('Not found' in pg.inner_text('main'),'guest cannot open pending spot')
    # archive locked
    pg.goto(BASE+'/#archive'); pg.wait_for_selector('main h1')
    ok('Pro' in pg.inner_text('main') and pg.locator('.tile').count()==0,'archive locked for guest')
    pg.goto(BASE+'/#events'); pg.wait_for_selector('.evl')
    ok('Cars & coffee' in pg.inner_text('.evl'),'events list')
    pg.goto(BASE+'/#ranking'); pg.wait_for_selector('.rank')
    ok('@ben' in pg.inner_text('.rank'),'ranking')
    pg.goto(BASE+'/#upload'); pg.wait_for_selector('main h1')
    ok(pg.locator('button[data-act=login]').count()>=1,'upload gate for guest')
    # login
    pg.click('header button[data-act=login]'); pg.wait_for_selector('.mod')
    pg.fill('#ae','ana@x.at'); pg.fill('#ap','password1'); pg.click('.mod button[type=submit]')
    pg.wait_for_selector('header a[href="#profile-ana"]')
    ok(True,'login ana')
    pg.goto(BASE+'/#car-1'); pg.wait_for_selector('.facts')
    t=pg.inner_text('.facts'); ok('Production' in t and 'LOG IN' not in t.upper(),'member: production number row without log-in pills')
    pg.click('button[data-act=ptab][data-v=specs]'); t=pg.inner_text('.facts'); ok('Engine' in t and 'LOG IN' not in t.upper(),'member: full spec on the Specifics tab')
    # like
    pg.click('button[data-act=like]'); pg.wait_for_selector('button[data-act=like][aria-pressed=true]')
    ok(True,'like works')
    pg.click('button[data-act=fav]'); pg.wait_for_selector('button[data-act=fav][aria-pressed=true]'); ok(True,'fav works')
    # comment with bad word
    pg.fill('#ct','this is shit nice car'); pg.click('form[data-form=comment] button[type=submit]'); pg.wait_for_selector('.cm')
    t=pg.inner_text('.cm'); ok('•••' in t and 'Filtered' in t,'comment filtered: '+t[:60].replace('\n',' '))
    # pending spot visible to owner
    pg.goto(BASE+'/#car-7'); pg.wait_for_selector('.banner')
    ok('Only you' in pg.inner_text('.banner'),'owner sees pending banner')
    # archive still locked for non-pro
    pg.goto(BASE+'/#archive'); pg.wait_for_selector('main h1'); ok(pg.locator('.tile').count()==0,'archive locked for non-pro member')
    # profile
    pg.goto(BASE+'/#profile-ana'); pg.wait_for_selector('.garage')
    ok(pg.locator('.garage .slot').count()==3,'garage 3 slots (got %d)'%pg.locator('.garage .slot').count())
    pg.select_option('select[data-gsel]', 'svj'); pg.wait_for_selector('.slot.full')
    ok(True,'garage add')
    print('\n'.join(errs) or 'no console errors')
    b.close()
sys.exit(1 if [e for e in errs if e.startswith(('FAIL','PAGEERR','CONSOLE'))] else 0)
