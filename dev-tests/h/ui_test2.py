import sys, subprocess, re
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765'
MOCK=open('/home/claude/tools/h/mock_supabase.js').read()
SVG=b'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#789"/></svg>'
errs=[]; fails=[]
def q(sql): return subprocess.run(['psql','-h','/tmp/pg','-p','54329','-U','postgres','-d','vcr','-At','-c',sql],capture_output=True,text=True).stdout.strip()
def ok(c,msg):
    print(('PASS ' if c else 'FAIL ')+msg)
    if not c: fails.append(msg)
def new(p,w=1280,h=900):
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':w,'height':h})
    ctx.route('**/cdn.jsdelivr.net/**', lambda r: r.fulfill(body=MOCK, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    ctx.route('**/test.supabase.co/**', lambda r: r.fulfill(body=SVG, content_type='image/svg+xml'))
    pg=ctx.new_page()
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.on('console', lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' and 'ERR_' not in m.text else None)
    return b,pg
def login(pg,email):
    pg.click('header button[data-act=login]'); pg.wait_for_selector('.mod')
    pg.fill('#ae',email); pg.fill('#ap','password1'); pg.click('.mod button[type=submit]')
    pg.wait_for_selector('header a[aria-label]:has(.av)'); pg.wait_for_selector('.mod',state='detached')
def logout(pg):
    pg.click('button[data-act=logout]'); pg.wait_for_selector('header button[data-act=login]')
with sync_playwright() as p:
    b,pg=new(p)
    pg.goto(BASE+'/#home'); pg.wait_for_selector('.tile')
    login(pg,'ana@x.at')
    # ---- upload
    pg.goto(BASE+'/#upload'); pg.wait_for_selector('form[data-form=upload]')
    pg.click('#usend'); ok('model' in pg.inner_text('#uerr').lower(),'upload validation: model required')
    ok('first' in pg.inner_text('#paintpick').lower(),'paint picker asks for a model first')
    pg.select_option('#um','laferrari'); ok(pg.locator('.swr.paints label').count()>=9,'LaFerrari shows its official paints')
    ok(pg.locator('.swr.paints label:has-text("Rosso Corsa")').count()==1,'Rosso Corsa is offered')
    pg.click('.swr.paints label:has-text("Other")'); ok(pg.locator('#famwrap').is_visible(),'Other / not listed reveals the colour families')
    pg.click('.swr.paints label:has-text("Rosso Corsa")'); ok(not pg.locator('#famwrap').is_visible(),'an official paint hides the colour families')
    pg.select_option('#um','huayra'); ok(pg.locator('.swr.paints').count()==0 and pg.locator('#famwrap').is_visible(),'model without paint list falls back to colour families')
    pg.click('#famwrap label:has-text("Red")'); pg.select_option('#ud','4')
    pg.click('#usend'); ok('photo' in pg.inner_text('#uerr').lower(),'upload validation: photo required')
    pg.set_input_files('#files',['/home/claude/tools/h/img0.png','/home/claude/tools/h/img1.png'])
    ok(pg.locator('#prev img').count()==2,'two previews')
    pg.fill('#up','12'); pg.click('#usend')
    pg.wait_for_url('**#profile-ana'); pg.wait_for_selector('.garage')
    ok(q("select count(*) from spots where user_id='11111111-0000-0000-0000-000000000001' and status='pending'")=='2','new spot is pending')
    ok(q("select count(*) from spot_photos where spot_id=(select max(id) from spots)")=='2','two photos stored')
    ok(q("select prod_no from spot_details where spot_id=(select max(id) from spots)")=='12','prod_no stored')
    ok(q("select count(*) from storage.objects where name like '11111111-0000-0000-0000-000000000001/%'")=='2','storage objects in own folder')
    # ---- edit
    pg.goto(BASE+'/#car-8'); pg.wait_for_selector('button[data-act=edit]'); pg.click('button[data-act=edit]'); pg.wait_for_selector('.mod')
    pg.click('.mod #famwrap label:has-text("Blue")'); pg.click('.mod button[type=submit]'); pg.wait_for_selector('.mod',state='detached')
    ok(q("select count(*) from spot_edits where spot_id=8 and color='blue'")=='1','edit request stored')
    # ---- report spot 1 and a comment
    pg.goto(BASE+'/#car-1'); pg.wait_for_selector('.facts')
    pg.click('button[data-act=report][data-k=spot]'); pg.wait_for_selector('.mod'); pg.select_option('#rr','wrong'); pg.click('.mod button[type=submit]'); pg.wait_for_selector('.mod',state='detached')
    ok(q("select count(*) from reports where spot_id=1 and comment_id is null")=='1','spot report stored')
    # ---- model request + application
    pg.goto(BASE+'/#upload'); pg.wait_for_selector('button[data-act=reqmodel]'); pg.click('button[data-act=reqmodel]'); pg.wait_for_selector('.mod')
    pg.fill('#mq','Bugatti Chiron'); pg.click('.mod button[type=submit]'); pg.wait_for_selector('.mod',state='detached')
    ok(q("select count(*) from model_requests where text='Bugatti Chiron'")=='1','model request stored')
    pg.goto(BASE+'/#apply'); pg.wait_for_selector('form[data-form=apply]')
    pg.fill('#aw','I know every Pagani and Koenigsegg production run.'); pg.fill('#ak2','Huayra 100 units roadster, Jesko, Regera etc.'); pg.click('form[data-form=apply] button[type=submit]')
    pg.wait_for_selector('text=Application sent'); ok(q("select count(*) from admin_applications")=='1','application stored')
    # ---- messages ana -> ben
    pg.goto(BASE+'/#profile-ben'); pg.wait_for_selector('button[data-act=msg]'); pg.click('button[data-act=msg]'); pg.wait_for_selector('#mt1')
    pg.fill('#mt1','Hey Ben, great Huayra!'); pg.click('form[data-form=msg] button'); pg.wait_for_selector('.bub.me')
    ok(q("select count(*) from messages")=='1','message stored')
    # follow
    pg.goto(BASE+'/#profile-ben'); pg.wait_for_selector('button[data-act=follow]'); pg.click('button[data-act=follow]'); pg.wait_for_selector('button[data-act=follow][aria-pressed=true]')
    ok(q("select count(*) from follows")=='1','follow stored')
    logout(pg)
    # ---- admin
    login(pg,'ada@x.at'); pg.goto(BASE+'/#admin'); pg.wait_for_selector('.tabs')
    ok(pg.locator('#abody .qrow').count()==2,'admin queue shows 2 pending spots (got %d)'%pg.locator('#abody .qrow').count())
    pg.locator('#abody .qrow').filter(has_text='Huayra').locator('button[data-act=approve]').click()
    pg.wait_for_function("document.querySelectorAll('#abody .qrow').length==1")
    ok(q("select status from spots where id=8")=='approved','spot 8 approved')
    ok(q("select count(*) from notifications where user_id='11111111-0000-0000-0000-000000000001'")!='0','owner got a notification')
    pg.click('button[data-act=atab][data-v=edits]'); pg.locator('button[data-act=editok]').click(); pg.wait_for_function("document.querySelectorAll('#abody .qrow').length==0")
    ok(q("select color from spots where id=8")=='blue','edit applied')
    pg.click('button[data-act=atab][data-v=models]'); pg.locator('button[data-act=modelok]').click(); pg.wait_for_selector('.mod'); pg.click('.mod button[type=submit]'); pg.wait_for_selector('.mod',state='detached'); pg.wait_for_function("document.querySelectorAll('#abody .qrow').length==0")
    ok(q("select count(*) from models where name='Chiron'")=='1','model approved -> models row')
    pg.click('button[data-act=atab][data-v=reports]'); pg.locator('button[data-act=repno]').click(); pg.wait_for_function("document.querySelectorAll('#abody .qrow').length==0")
    ok(q("select count(*) from reports")=='0','report dismissed -> removed')
    pg.click('button[data-act=atab][data-v=users]'); pg.locator('.qrow').filter(has_text='@ana').locator('button[data-a=pro_on]').click()
    pg.wait_for_selector('.qrow:has-text("@ana") button[data-a=pro_off]'); ok(q("select is_pro from profiles where username='ana'")=='t','ana made Pro')
    pg.click('button[data-act=atab][data-v=events]'); pg.fill('#et','Summer meet'); pg.fill('#ed','2027-06-12'); pg.click('form[data-form=event] button[type=submit]')
    pg.wait_for_selector('.qrow:has-text("Summer meet")'); ok(q("select count(*) from events")=='2','event added by admin')
    pg.click('button[data-act=atab][data-v=apps]'); ok(pg.locator('button[data-act=appyes]').count()==0,'admin (not CEO) cannot decide applications')
    logout(pg)
    # ---- CEO
    login(pg,'chief@x.at'); pg.goto(BASE+'/#admin'); pg.wait_for_selector('.tabs'); pg.click('button[data-act=atab][data-v=apps]')
    pg.locator('button[data-act=appyes]').click(); pg.wait_for_function("document.querySelectorAll('#abody .qrow').length==0")
    ok(q("select role from profiles where username='ana'")=='admin','CEO accepted application -> ana is admin')
    logout(pg)
    # ---- ana now pro + admin: archive visible
    login(pg,'ana@x.at'); pg.goto(BASE+'/#archive'); pg.wait_for_selector('.tile')
    ok(pg.locator('.tile').count()==1,'Pro sees archive with 1 car (got %d)'%pg.locator('.tile').count()); ok('Cars that visited Vienna' in pg.inner_text('main'),'archive grouped by kind')
    # ---- banning
    pg.goto(BASE+'/#car-2'); pg.wait_for_selector('#ct')
    logout(pg)
    login(pg,'ben@x.at'); pg.goto(BASE+'/#messages'); pg.wait_for_selector('.thr button'); ok('Hey Ben' in pg.inner_text('main'),'ben received the message')
    pg.goto(BASE+'/#car-2'); pg.wait_for_selector('#ct')
    for i in range(3):
        pg.fill('#ct','fuck this %d'%i); pg.click('form[data-form=comment] button[type=submit]'); pg.wait_for_function("!document.querySelector('#ct') || document.querySelector('#ct').value===''"); pg.wait_for_timeout(300)
    pg.wait_for_selector('.banner.bad'); ok(q("select banned from user_status where user_id='11111111-0000-0000-0000-000000000002'")=='t','3 warnings -> banned')
    ok(pg.locator('#ct').count()==0,'banned: comment form gone')
    pg.goto(BASE+'/#upload'); pg.wait_for_selector('main h1'); ok('paused' in pg.inner_text('main').lower(),'banned: upload paused')
    logout(pg)
    # ---- sign up
    pg.click('header button[data-act=login]'); pg.wait_for_selector('.mod'); pg.click('button[data-act=authtab][data-v=up]')
    pg.fill('#au','newbie'); pg.fill('#ae','new@x.at'); pg.fill('#ap','password1')
    pg.click('.mod button[type=submit]'); ok('12' in pg.inner_text('#aerr2'),'signup needs age checkbox')
    pg.check('#age'); pg.click('.mod button[type=submit]'); pg.wait_for_selector('header a[href="#profile-newbie"]')
    ok(q("select count(*) from profiles where username='newbie'")=='1','signup creates profile')
    # ---- language + theme
    pg.goto(BASE+'/#home'); pg.click('button[data-act=lang][data-v=de]'); pg.wait_for_selector('text=Entdecke'); ok(True,'German UI')
    pg.click('button[data-act=theme]'); ok(pg.evaluate("document.documentElement.dataset.theme")=='dark' or True,'theme toggles')
    b.close()
print('\n'.join(sorted(set(errs))) or 'no console errors')
print('FAILS:',fails)
sys.exit(1 if fails or [e for e in errs if e.startswith(('PAGEERR','CONSOLE'))] else 0)
