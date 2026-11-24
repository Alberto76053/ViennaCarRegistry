import sys
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765'
MOCK=open('/home/claude/tools/h/mock_supabase.js').read()
SVG=b'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#789"/></svg>'
fails=[]
def ok(c,m):
    print(('PASS ' if c else 'FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for name,w,h in [('desktop',1280,900),('mobile',390,800)]:
        ctx=b.new_context(viewport={'width':w,'height':h})
        ctx.route('**/cdn.jsdelivr.net/**', lambda r: r.fulfill(body=MOCK, content_type='application/javascript'))
        ctx.route('**/fonts.g*/**', lambda r: r.abort())
        ctx.route('**/test.supabase.co/**', lambda r: r.fulfill(body=SVG, content_type='image/svg+xml'))
        pg=ctx.new_page()
        for route in ['home','car-2','events','ranking','pro','upload','archive']:
            pg.goto(BASE+'/#'+route); pg.wait_for_selector('main h1'); pg.wait_for_timeout(300)
            ov=pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
            ok(ov<=1,f'{name} #{route}: no horizontal overflow ({ov}px)')
        pg.goto(BASE+'/#home'); pg.wait_for_selector('.tile'); pg.screenshot(path=f'/home/claude/tools/h/{name}_home.png')
        pg.goto(BASE+'/#car-1'); pg.wait_for_selector('.facts'); pg.screenshot(path=f'/home/claude/tools/h/{name}_car.png')
        pg.click('header button[data-act=login]'); pg.wait_for_selector('.mod')
        ok(pg.locator('.mod button[data-act=oauth]').count()==2,f'{name}: Google and Apple buttons shown when configured')
        pg.screenshot(path=f'/home/claude/tools/h/{name}_login.png')
        # oauth without age checkbox blocked
        pg.click('button[data-act=oauth][data-p=google]'); ok('12' in pg.inner_text('#aerr2'),f'{name}: OAuth needs age confirmation')
        ctx.close()
    # dark mode + keyboard focus
    ctx=b.new_context(viewport={'width':1280,'height':900}, color_scheme='dark')
    ctx.route('**/cdn.jsdelivr.net/**', lambda r: r.fulfill(body=MOCK, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort()); ctx.route('**/test.supabase.co/**', lambda r: r.fulfill(body=SVG, content_type='image/svg+xml'))
    pg=ctx.new_page(); pg.goto(BASE+'/#home'); pg.wait_for_selector('.tile')
    ok(pg.evaluate("document.documentElement.dataset.theme")=='dark','dark is the default')
    pg.click('button[data-act=theme]'); pg.wait_for_selector('html[data-theme=light]'); pg.reload(); pg.wait_for_selector('.tile')
    ok(pg.evaluate("document.documentElement.dataset.theme")=='light','light choice is remembered after reload')
    pg.screenshot(path='/home/claude/tools/h/light_home.png')
    ctx.close()
    # unconfigured -> setup page
    ctx=b.new_context(); ctx.route('**/cdn.jsdelivr.net/**', lambda r: r.fulfill(body=MOCK, content_type='application/javascript')); ctx.route('**/fonts.g*/**', lambda r: r.abort())
    ctx.route('**/js/config.js*', lambda r: r.fulfill(body="export const SUPABASE_URL='https://DEIN-PROJEKT.supabase.co';export const SUPABASE_ANON_KEY='DEIN-ANON-KEY';export const OAUTH_PROVIDERS=[];", content_type='application/javascript'))
    pg=ctx.new_page(); pg.goto(BASE+'/#home'); pg.wait_for_selector('.setup'); ok('schema.sql' in pg.inner_text('.setup'),'placeholder config shows setup page')
    b.close()
print('FAILS:',fails); sys.exit(1 if fails else 0)
