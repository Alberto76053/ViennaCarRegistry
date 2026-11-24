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
mode = sys.argv[1] if len(sys.argv) > 1 else 'full'
with sync_playwright() as p:
    b,pg=new(p)
    pg.goto(BASE+'/#home'); pg.wait_for_selector('.stats')
    if mode == 'empty':
        pg.wait_for_selector('.empty'); ok('No cars yet' in pg.inner_text('.empty'),'empty registry shows an invitation, not fake cars')
        ok(pg.locator('svg').filter(has=pg.locator('rect[fill]')).count()==0 and pg.locator('.tile').count()==0,'no demo cars when the registry is empty')
with sync_playwright() as p:
    b,pg=new(p)
    pg.goto(BASE+'/#home'); pg.wait_for_selector('.tile')
    ok(pg.locator('.cotm').count()==0,'no car of the month while nobody has liked anything')
    # ---- guests: state filter
    pg.goto(BASE+'/#cars'); pg.wait_for_selector('#fr')
    ok(pg.locator('#fr option').all_inner_texts()==['All states','Wien','Niederösterreich'],'state filter lists only the open states')
    pg.select_option('#fr','noe'); pg.wait_for_selector('.empty'); ok(pg.locator('.tile').count()==0,'no cars in Niederösterreich yet')
    pg.select_option('#fr','wien'); pg.wait_for_selector('.tile'); ok(pg.locator('.tile').count()==5,'5 cars in Wien (got %d)'%pg.locator('.tile').count())
    pg.goto(BASE+'/#car-3'); pg.wait_for_selector('.loc'); ok('1020 Leopoldstadt, Wien, Austria' in pg.inner_text('.loc'),'location line shows district, state and country: '+pg.inner_text('.loc'))
    ok(pg.locator('.tline').count()==0,'guests do not see the sighting history')
    # ---- ben: like, comment with mention, spot in Niederösterreich
    login(pg,'ben@x.at'); pg.goto(BASE+'/#car-3'); pg.wait_for_selector('#ct')
    ok(pg.locator('.tline li').count()==1 and 'Leopoldstadt' in pg.inner_text('.tline'),'history starts with the upload sighting')
    pg.click('button[data-act=like]'); pg.wait_for_selector('button[data-act=like][aria-pressed=true]')
    pg.fill('#ct','Schön! @ana und @niemand'); pg.click('form[data-form=comment] button[type=submit]'); pg.wait_for_selector('.cm')
    ok(pg.locator('a.mention[href="#profile-ana"]').count()==1,'@ana becomes a link')
    ok('@niemand' in pg.inner_text('.cm p') and pg.locator('a.mention[href="#profile-niemand"]').count()==0,'unknown names stay plain text')
    ok(q("select count(*) from notifications where text_en='ben mentioned you in a comment on Lamborghini Aventador SVJ.'")=='1','ana is told about the mention')
    pg.click('button[data-act=spotted]'); pg.wait_for_selector('.mod #sd')
    ok(pg.locator('.mod #sd optgroup').count()==2,'district list is grouped by open state')
    pg.select_option('#sd','102'); pg.click('.mod button[type=submit]'); pg.wait_for_selector('.mod',state='detached')
    pg.wait_for_selector('.tline li:nth-child(2)'); ok('Baden' in pg.inner_text('.tline') and 'Niederösterreich' in pg.inner_text('.tline'),'history shows the new sighting in Niederösterreich')
    ok(q("select district from spot_marks where user_id='11111111-0000-0000-0000-000000000002' and spot_id=3")=='102','sighting stored with the NÖ district')
    pg.goto(BASE+'/#home'); pg.wait_for_selector('.cotm')
    ok('Car of the month' in pg.inner_text('.cotm') and 'SVJ' in pg.inner_text('.cotm') and '1 like' in pg.inner_text('.cotm'),'car of the month appears: '+pg.inner_text('.cotm').replace('\n',' | '))
    ok(pg.locator('.cotm').get_attribute('href')=='#car-3','car of the month links to the car')
    logout(pg)
    # ---- ana: reply, upload in Niederösterreich, badges
    login(pg,'ana@x.at'); pg.goto(BASE+'/#car-3'); pg.wait_for_selector('button[data-act=reply]')
    pg.click('button[data-act=reply]'); pg.wait_for_selector('#replyto:not([hidden])')
    ok(pg.input_value('#ct').startswith('@ben ') and 'ben' in pg.inner_text('#replyto'),'reply prefills the name and shows who you answer')
    pg.click('button[data-act=cancelreply]'); ok(pg.locator('#replyto[hidden]').count()==1 and pg.input_value('form[data-form=comment] input[name=parent]')=='','cancel clears the reply target')
    pg.click('button[data-act=reply]'); pg.fill('#ct','@ben danke dir!'); pg.click('form[data-form=comment] button[type=submit]'); pg.wait_for_selector('.replies .cm')
    ok(pg.locator('.replies .cm').count()==1 and pg.locator('.replies a.mention[href="#profile-ben"]').count()==1,'reply is shown under the main comment, mention linked')
    ok(q("select count(*) from comments where body like '@ben danke%' and parent_id is not null")=='1','reply stored with parent')
    ok(q("select count(*) from notifications where user_id='11111111-0000-0000-0000-000000000002' and text_en like 'ana replied%'")=='1','ben gets exactly one note for reply + mention')
    pg.goto(BASE+'/#upload'); pg.wait_for_selector('#um'); pg.select_option('#um','laferrari'); pg.click('.swr.paints label:has-text("Rosso Corsa")')
    ok(pg.locator('#ud option').filter(has_text='Amstetten').count()==1 and pg.locator('#ud option').filter(has_text='Eisenstadt').count()==0,'NÖ districts offered, closed states not')
    pg.select_option('#ud','101'); pg.set_input_files('#files',['/home/claude/tools/h/img0.png']); pg.click('#usend'); pg.wait_for_url('**#profile-ana'); pg.wait_for_selector('.garage')
    ok(q("select district from spots order by id desc limit 1")=='101','car uploaded in Amstetten')
    pg.wait_for_selector('.badges'); ok(pg.locator('.badge').count()==9,'nine badges listed')
    ok(pg.locator('.badge.on').count()==1 and 'First car' in pg.inner_text('.badge.on'),'ana has exactly one badge: '+pg.inner_text('.badges').replace('\n',' | ')[:160])
    ok(pg.locator('.badge:not(.on) .prog').count()==8,'locked badges show their progress')
    logout(pg)
    # ---- admin sees no state switch, CEO does
    login(pg,'ada@x.at'); pg.goto(BASE+'/#admin'); pg.wait_for_selector('.tabs')
    ok(pg.locator('button[data-act=atab][data-v=regions]').count()==0,'admin (not CEO) has no states tab')
    logout(pg)
    login(pg,'chief@x.at'); pg.goto(BASE+'/#admin'); pg.wait_for_selector('.tabs')
    pg.click('button[data-act=atab][data-v=regions]'); pg.wait_for_selector('#abody .qrow')
    ok(pg.locator('#abody .qrow').count()==9 and pg.locator('#abody .tag.ok').count()==2,'nine states, two active')
    pg.click('.qrow:has-text("Burgenland") button[data-act=regiontoggle]'); pg.wait_for_selector('.qrow:has-text("Burgenland") .tag.ok')
    ok(q("select active from regions where id='bgld'")=='t','CEO opened Burgenland')
    pg.goto(BASE+'/#upload'); pg.wait_for_selector('#ud'); ok(pg.locator('#ud optgroup').count()==3 and pg.locator('#ud option').filter(has_text='Eisenstadt (Stadt)').count()==1,'upload now offers Burgenland')
    pg.goto(BASE+'/#admin'); pg.wait_for_selector('.tabs'); pg.click('button[data-act=atab][data-v=regions]'); pg.click('.qrow:has-text("Burgenland") button[data-act=regiontoggle]')
    pg.wait_for_function("!document.querySelector('.qrow') || ![...document.querySelectorAll('.qrow')].find(r => r.textContent.includes('Burgenland') && r.querySelector('.tag.ok'))")
    ok(q("select active from regions where id='bgld'")=='f','CEO closed Burgenland again')
    b.close(); print('no console errors' if not errs else errs); print('FAILS:',fails); sys.exit(1 if fails or errs else 0)
