create schema if not exists t;
grant usage on schema t to anon, authenticated;
create or replace function t.as_(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
  if uid is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
end $$;
create or replace function t.fails(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return true; end $$;
grant execute on all functions in schema t to anon, authenticated;

do $$
declare a uuid:='aaaaaaaa-0000-0000-0000-000000000001'; b uuid:='aaaaaaaa-0000-0000-0000-000000000002';
        adm uuid:='aaaaaaaa-0000-0000-0000-000000000003'; ceo uuid:='aaaaaaaa-0000-0000-0000-000000000004';
        pro uuid:='aaaaaaaa-0000-0000-0000-000000000005';
        sid bigint; pid bigint; aid bigint; n int; txt text; eid bigint; rid bigint; cid bigint;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
   (a,'a@x.at','{"username":"Alice"}'),(b,'b@x.at','{"username":"bob"}'),(adm,'adm@x.at','{"username":"adm1n"}'),
   (ceo,'ceo@x.at','{"username":"theceo"}'),(pro,'pro@x.at','{}');
  update profiles set role='admin' where id=adm;
  update profiles set role='ceo' where id=ceo;
  update profiles set is_pro=true where id=pro;
  assert (select username from profiles where id=a)='alice', 'username lower';
  assert (select username from profiles where id=pro)='pro', 'username from email';
  insert into auth.users(id,email,raw_user_meta_data) values ('aaaaaaaa-0000-0000-0000-000000000009','z@x.at','{"username":"alice"}');
  assert (select username from profiles where id='aaaaaaaa-0000-0000-0000-000000000009')<>'alice', 'dup username';
  assert (select count(*) from notifications where user_id=a)=1, 'welcome note';
  raise notice 'PASS signup/profile trigger';

  -- spots
  perform t.as_(a);
  insert into spots(user_id,model_id,color,district) values (a,'laferrari','yellow',1) returning id into sid;
  insert into spot_details(spot_id,prod_no) values (sid,'214');
  insert into spot_photos(spot_id,path,position) values (sid, a||'/1.jpg',0);
  assert (select count(*) from spots)=1, 'owner sees own pending';
  assert t.fails($q$insert into spots(user_id,model_id,color,district,status) values (auth.uid(),'p1','red',2,'approved')$q$), 'cannot self-approve on insert';
  assert t.fails($q$insert into spots(user_id,model_id,color,district) values ('aaaaaaaa-0000-0000-0000-000000000002','p1','red',2)$q$), 'cannot spot as someone else';
  update spots set status='approved' where id=sid;
  reset role;
  assert (select status from spots where id=sid)='pending', 'cannot self-approve by update';
  perform t.as_(b); assert (select count(*) from spots)=0, 'other member sees no pending'; reset role;
  perform t.as_(null); assert (select count(*) from spots)=0, 'anon sees no pending'; reset role;
  perform t.as_(adm); update spots set status='approved' where id=sid; reset role;
  assert (select approved_at from spots where id=sid) is not null, 'approved_at set';
  assert exists(select 1 from notifications where user_id=a and text_en like '%approved%'), 'approve notification';
  perform t.as_(null);
  assert (select count(*) from spots)=1, 'anon sees approved';
  assert (select count(*) from spot_photos)=1, 'anon sees photos';
  assert (select count(*) from spot_details)=0, 'anon sees no details';
  begin perform 1 from model_specs; assert false, 'anon must not read model_specs'; exception when insufficient_privilege then null; end;
  assert (select count(*) from models)=7, 'anon sees models';
  assert (select likes from spot_stats where spot_id=sid)=0, 'stats visible';
  reset role;
  perform t.as_(b);
  assert (select count(*) from spot_details)=1 and (select count(*) from model_specs)=6, 'member sees details';
  reset role;
  raise notice 'PASS spots visibility';

  -- profile guard
  perform t.as_(a);
  assert t.fails($q$update profiles set role='admin' where id=auth.uid()$q$), 'no self role';
  assert t.fails($q$update profiles set is_pro=true where id=auth.uid()$q$), 'no self pro';
  update profiles set bio='hi' where id=a;
  update profiles set bio='hacked' where id=b;
  reset role;
  assert (select bio from profiles where id=b)='', 'cannot edit others';
  assert (select bio from profiles where id=a)='hi', 'own bio';
  perform t.as_(adm); perform admin_user_action(b,'pro_on'); reset role;
  assert (select is_pro from profiles where id=b), 'admin sets pro';
  perform t.as_(a); assert t.fails($q$select admin_user_action(auth.uid(),'pro_on')$q$), 'member cannot call admin action'; reset role;
  perform t.as_(adm); perform admin_user_action(b,'pro_off'); reset role;
  raise notice 'PASS profile guards';

  -- archive visibility
  perform t.as_(a);
  insert into spots(user_id,model_id,color,district,kind,arch_kind) values (a,'p1','grey',2,'archive','ex') returning id into aid;
  assert t.fails($q$insert into spots(user_id,model_id,color,district,kind) values (auth.uid(),'p1','grey',2,'archive')$q$), 'archive needs arch_kind';
  reset role;
  perform t.as_(adm); update spots set status='approved' where id=aid; reset role;
  perform t.as_(null); assert (select count(*) from spots where kind='archive')=0, 'anon no archive'; reset role;
  perform t.as_(b); assert (select count(*) from spots where kind='archive')=0, 'member no archive'; reset role;
  perform t.as_(pro); assert (select count(*) from spots where kind='archive')=1, 'pro sees archive'; reset role;
  perform t.as_(adm); assert (select count(*) from spots where kind='archive')=1, 'admin sees archive'; reset role;
  raise notice 'PASS archive pro-only';

  -- comments + filter + ban
  perform t.as_(null); assert (select count(*) from comments)=0, 'anon no comments'; reset role;
  perform t.as_(b);
  insert into comments(spot_id,user_id,body) values (sid,b,'nice car');
  insert into comments(spot_id,user_id,body) values (sid,b,'you idiot, so dumm') returning id into cid;
  reset role;
  assert (select body from comments where id=cid)='you •••, so dumm', 'filtered body: '||(select body from comments where id=cid);
  assert (select filtered from comments where id=cid), 'filtered flag';
  assert (select warnings from user_status where user_id=b)=1, 'warning 1';
  perform t.as_(b);
  insert into comments(spot_id,user_id,body) values (sid,b,'Scheiße!');
  insert into comments(spot_id,user_id,body) values (sid,b,'FUCK this');
  reset role;
  assert (select banned from user_status where user_id=b), 'banned after 3';
  perform t.as_(b);
  assert t.fails($q$insert into comments(spot_id,user_id,body) values (1,auth.uid(),'hello')$q$), 'banned cannot comment';
  assert t.fails($q$insert into spots(user_id,model_id,color,district) values (auth.uid(),'p1','red',2)$q$), 'banned cannot upload';
  assert (select count(*) from user_status)=1, 'user_status only own';
  reset role;
  perform t.as_(adm); assert (select count(*) from user_status)>=5, 'admin sees statuses'; perform admin_user_action(b,'unban'); reset role;
  assert not (select banned from user_status where user_id=b), 'unbanned';
  raise notice 'PASS comment filter and bans';

  -- garage
  perform t.as_(a);
  insert into garage(user_id,slot,model_id) values (a,0,'laferrari'),(a,1,'p1'),(a,2,'918');
  assert t.fails($q$insert into garage(user_id,slot,model_id) values (auth.uid(),3,'p1')$q$), 'slot 3 locked';
  reset role;
  insert into spots(user_id,model_id,color,district,status) select a,'svj','black',3,'approved' from generate_series(1,3);
  assert garage_slots(a)=4, 'slots with 5 approved: '||garage_slots(a);
  raise notice 'PASS garage (slots=%)', garage_slots(a);
  perform t.as_(a);
  insert into garage(user_id,slot,model_id) values (a,3,'p1');
  assert t.fails($q$insert into garage(user_id,slot,model_id) values (auth.uid(),4,'p1')$q$), 'slot 4 locked';
  reset role;

  -- messages and blocks
  perform t.as_(a); insert into messages(sender_id,recipient_id,body) values (a,pro,'hello'); 
  assert t.fails($q$insert into messages(sender_id,recipient_id,body) values (auth.uid(),'aaaaaaaa-0000-0000-0000-000000000003','x'),('aaaaaaaa-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000003','spoof')$q$), 'no spoofed sender';
  reset role;
  perform t.as_(pro); assert (select count(*) from messages)=1, 'recipient reads'; insert into blocks(blocker_id,blocked_id) values (pro,a); reset role;
  perform t.as_(a); assert t.fails($q$insert into messages(sender_id,recipient_id,body) values (auth.uid(),'aaaaaaaa-0000-0000-0000-000000000005','x')$q$), 'blocked cannot message'; reset role;
  perform t.as_(b); assert (select count(*) from messages)=0, 'third party sees none'; reset role;
  perform t.as_(b); assert not is_blocked_between(a, pro), 'block list is private: third party learns nothing'; reset role;
  perform t.as_(a); assert is_blocked_between(a, pro), 'a blocked person sees the block'; reset role;
  perform t.as_(null);
  assert t.fails($q$select public.is_blocked_between('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000005')$q$), 'guest cannot call is_blocked_between';
  assert t.fails($q$select public.apply_edit(1)$q$), 'guest cannot call admin functions';
  assert t.fails($q$select public.admin_user_action('aaaaaaaa-0000-0000-0000-000000000001','ban')$q$), 'guest cannot call admin_user_action';
  assert (select count(*) from spots)>=1, 'guests still read approved cars (is_admin/is_pro_user stay callable)';
  reset role;
  perform t.as_(a); assert t.fails($q$select public.handle_new_user()$q$), 'trigger functions are not callable'; reset role;
  raise notice 'PASS messages/blocks';

  -- likes privacy and stats
  perform t.as_(a); insert into likes values (a,sid); insert into favorites values (a,sid); reset role;
  perform t.as_(b); assert (select count(*) from likes)=0, 'likes private'; reset role;
  perform t.as_(null); assert (select likes from spot_stats where spot_id=sid)=1, 'like count'; assert (select comments from spot_stats where spot_id=sid)=4, 'comment count'; reset role;
  raise notice 'PASS likes/stats';

  -- spotted marks
  assert (select count(*) from spot_marks where spot_id=sid and user_id=a)=1, 'uploader is the first spotter';
  perform t.as_(a); insert into spots(user_id,model_id,color,district) values (a,'p1','red',2) returning id into pid; reset role;
  perform t.as_(b);
  assert t.fails(format($q$insert into spot_marks(spot_id,user_id,district) values (%s,auth.uid(),8)$q$, pid)), 'cannot mark a pending car';
  assert (select count(*) from spot_marks where spot_id=pid)=0, 'marks of pending car stay hidden';
  insert into spot_marks(spot_id,user_id,district,spotted_on) values (sid,b,7,current_date);
  assert t.fails(format($q$insert into spot_marks(spot_id,user_id,district) values (%s,auth.uid(),8)$q$, sid)), 'one mark per user and day';
  assert t.fails(format($q$insert into spot_marks(spot_id,user_id,district) values (%s,'aaaaaaaa-0000-0000-0000-000000000001',8)$q$, sid)), 'cannot mark as someone else';
  assert t.fails(format($q$insert into spot_marks(spot_id,user_id,district,spotted_on) values (%s,auth.uid(),8,current_date-40)$q$, sid)), 'sighting older than 30 days refused';
  assert t.fails(format($q$insert into spot_marks(spot_id,user_id,district,spotted_on) values (%s,auth.uid(),8,current_date+5)$q$, sid)), 'future sighting refused';
  assert t.fails(format($q$insert into spot_marks(spot_id,user_id,district) values (%s,auth.uid(),24)$q$, sid)), 'district range';
  assert (select count(*) from spot_marks where spot_id=sid)=2, 'member sees the marks';
  reset role;
  assert (select district from spots where id=sid)=7, 'newest sighting sets the district';
  assert exists(select 1 from notifications where user_id=a and text_en like '%spotted your%'), 'uploader is told';
  perform t.as_(pro); insert into spot_marks(spot_id,user_id,district,spotted_on) values (sid,pro,9,current_date-3); reset role;
  assert (select district from spots where id=sid)=7, 'older sighting keeps the district';
  assert (select count(*) from notifications where user_id=a and text_en like '%spotted your%')=2, 'second spotter notified too';
  perform t.as_(null); assert (select count(*) from spot_marks)=0, 'guest sees no marks'; assert t.fails(format($q$insert into spot_marks(spot_id,user_id,district) values (%s,auth.uid(),8)$q$, sid)), 'guest cannot mark'; reset role;
  raise notice 'PASS spotted marks';

  -- edits
  perform t.as_(a); insert into spot_edits(spot_id,user_id,color,district,prod_no) values (sid,a,'blue',5,'12') returning id into eid; reset role;
  perform t.as_(ceo); assert t.fails(format($q$insert into spot_edits(spot_id,user_id,color) values (%s,auth.uid(),'red')$q$, sid)), 'edits only from uploader or spotters'; reset role;
  perform t.as_(a); assert t.fails(format('select apply_edit(%s)', eid)), 'member cannot apply'; reset role;
  perform t.as_(adm); perform apply_edit(eid); reset role;
  assert (select color from spots where id=sid)='blue' and (select district from spots where id=sid)=5, 'edit applied';
  assert (select prod_no from spot_details where spot_id=sid)='12', 'prod applied';
  perform t.as_(b); insert into spot_edits(spot_id,user_id,color) values (sid,b,'green') returning id into eid;
  assert t.fails(format($q$insert into spot_edits(spot_id,user_id,color) values (%s,'aaaaaaaa-0000-0000-0000-000000000001','red')$q$, sid)), 'no edit in someone else name'; reset role;
  assert (select color from spots where id=sid)='blue', 'spotter edit waits for approval';
  perform t.as_(adm); perform apply_edit(eid); reset role;
  assert (select color from spots where id=sid)='green', 'spotter edit applied';
  perform t.as_(a); insert into spot_edits(spot_id,user_id,arch_kind) values (sid,a,'visit') returning id into eid; reset role;
  perform t.as_(adm); perform apply_edit(eid); reset role;
  assert (select kind from spots where id=sid)='archive' and (select arch_kind from spots where id=sid)='visit', 'archive request applied';
  raise notice 'PASS edits';

  -- applications
  perform t.as_(b); insert into admin_applications(user_id,why,knowledge) values (b, repeat('w',30), repeat('k',30)) returning id into rid; 
  assert t.fails($q$insert into admin_applications(user_id,why,knowledge) values (auth.uid(),'short','short')$q$), 'min length';
  reset role;
  perform t.as_(adm); assert t.fails(format('select decide_application(%s,true)', rid)), 'admin cannot decide'; reset role;
  perform t.as_(ceo); perform decide_application(rid,true); reset role;
  assert (select role from profiles where id=b)='admin', 'ceo promotes';
  raise notice 'PASS applications';

  -- reports
  perform t.as_(a); insert into reports(reporter_id,spot_id,comment_id,reason) values (a,sid,cid,'inappropriate');
  assert (select count(*) from reports)=0, 'reporter cannot read reports'; reset role;
  select id into rid from reports limit 1;
  perform t.as_(adm); assert (select count(*) from reports)=1, 'admin reads reports'; perform resolve_report(rid,true); reset role;
  assert not exists(select 1 from comments where id=cid), 'comment removed';
  raise notice 'PASS reports';

  -- model requests
  perform t.as_(a); insert into model_requests(user_id,text) values (a,'Bugatti Chiron') returning id into rid; reset role;
  perform t.as_(adm); perform approve_model_request(rid,'Bugatti','Chiron'); reset role;
  assert exists(select 1 from models where id='bugatti-chiron'), 'model added';
  raise notice 'PASS model requests';

  -- notifications column guard
  perform t.as_(a);
  assert t.fails($q$update notifications set text_en='x' where user_id=auth.uid()$q$), 'cannot edit note text';
  update notifications set read=true where user_id=auth.uid();
  assert (select count(*) from notifications where not read)=0, 'mark read';
  reset role;

  -- events
  perform t.as_(a); assert t.fails($q$insert into events(title,starts_on) values ('Meet','2027-05-01')$q$), 'user cannot add events'; reset role;
  perform t.as_(adm); insert into events(title,starts_on) values ('Meet','2027-05-01'); reset role;
  perform t.as_(null); assert (select count(*) from events)=1, 'anon reads events'; reset role;

  -- storage
  perform t.as_(a);
  insert into storage.objects(bucket_id,name) values ('spot-photos', a||'/x.jpg');
  assert t.fails(format('insert into storage.objects(bucket_id,name) values (%L,%L)','spot-photos', b||'/x.jpg')), 'storage other folder';
  reset role;


  -- official paints
  perform t.as_(null);
  assert (select count(*) from model_colors where model_id='laferrari' and name='Rosso Corsa')=1, 'anon reads paints';
  assert (select count(*) from model_colors)>=50, 'paint seed present';
  reset role;
  perform t.as_(a);
  assert t.fails($q$insert into model_colors(model_id,name,family,hex) values ('p1','Fake Pink','red','#FF00FF')$q$), 'user cannot add paints';
  reset role;
  perform t.as_(adm);
  insert into model_colors(model_id,name,family,hex) values ('huayra','Blu Tricolore','blue','#1F4FA3');
  assert t.fails($q$insert into model_colors(model_id,name,family,hex) values ('huayra','Bad Hex','blue','blue')$q$), 'hex validated';
  assert t.fails($q$insert into model_colors(model_id,name,family,hex) values ('huayra','Odd Family','pink','#FFC0CB')$q$), 'family validated';
  reset role;
  perform t.as_(a);
  insert into spots(user_id,model_id,color,paint,district) values (a,'laferrari','red','Rosso Corsa',1) returning id into sid;
  assert t.fails($q$insert into spots(user_id,model_id,color,paint,district) values (auth.uid(),'laferrari','red','x',1)$q$), 'paint min length';
  insert into spot_edits(spot_id,user_id,color,paint) values (sid,a,'yellow','Giallo Modena') returning id into eid;
  reset role;
  perform t.as_(adm); perform apply_edit(eid); reset role;
  assert (select paint from spots where id=sid)='Giallo Modena' and (select color from spots where id=sid)='yellow', 'edit applies paint';
  assert (select source from model_specs where model_id='laferrari') like 'https://www.ferrari.com%', 'spec source stored';
  assert not exists (select 1 from model_specs where model_id='huayra'), 'no unverified Huayra data';
  assert (select count(*) from model_specs where engine is not null and (source is null or source !~ '^https://'))=0, 'every spec row with data has a source link';
  raise notice 'PASS official paints';

  -- bad_words not readable
  perform t.as_(a);
  begin perform 1 from bad_words; assert false, 'bad_words must not be readable'; exception when insufficient_privilege then null; end;
  reset role;

  -- table grants (the project hands out no automatic rights to API roles)
  assert not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    cross join (values ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE')) p(priv)
    where n.nspname='public' and c.relkind='r' and has_table_privilege('anon', c.oid, p.priv)),
    'anon can only read';
  assert not has_table_privilege('anon','public.bad_words','select') and not has_table_privilege('authenticated','public.bad_words','select'), 'bad_words closed';
  assert not has_table_privilege('anon','public.messages','select') and not has_table_privilege('anon','public.notifications','select'), 'private tables closed to guests';
  assert not has_table_privilege('authenticated','public.profiles','delete') and not has_table_privilege('authenticated','public.user_status','update')
    and not has_table_privilege('authenticated','public.messages','delete') and not has_table_privilege('authenticated','public.comments','update'), 'no extra write rights for members';
  assert has_table_privilege('authenticated','public.likes','insert') and has_table_privilege('authenticated','public.spots','update')
    and has_table_privilege('authenticated','public.spot_marks','insert'), 'members can write what the policies allow';
  assert not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and not has_table_privilege('service_role', c.oid, 'select')), 'service role can read all';
  assert has_column_privilege('authenticated','public.notifications','read','update') and not has_column_privilege('authenticated','public.notifications','text_en','update'), 'notes: only read flag is writable';
  raise notice 'PASS table grants';
  raise notice 'ALL RLS TESTS PASSED';
end $$;

-- =====================================================================
-- Add-ons: Bundesländer, Auto des Monats, Abzeichen, Antworten und Erwähnungen
-- =====================================================================
do $$
declare x1 uuid:='bbbbbbbb-0000-0000-0000-000000000001'; x2 uuid:='bbbbbbbb-0000-0000-0000-000000000002';
        x3 uuid:='bbbbbbbb-0000-0000-0000-000000000003'; x4 uuid:='bbbbbbbb-0000-0000-0000-000000000004';
        admx uuid:='bbbbbbbb-0000-0000-0000-000000000005'; ceox uuid:='bbbbbbbb-0000-0000-0000-000000000006';
        x7 uuid:='bbbbbbbb-0000-0000-0000-000000000007';
        s1 bigint; s2 bigint; c1 bigint; c2 bigint; c3 bigint; n int; n0 int;
        prevm timestamptz := ((date_trunc('month', now() at time zone 'Europe/Vienna') - interval '5 days') at time zone 'Europe/Vienna');
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (x1,'x1@x.at','{"username":"xena"}'),(x2,'x2@x.at','{"username":"xavier"}'),(x3,'x3@x.at','{"username":"xander"}'),
    (x4,'x4@x.at','{"username":"xyla"}'),(admx,'ax@x.at','{"username":"xadmin"}'),(ceox,'cx@x.at','{"username":"xceo"}'),
    (x7,'x7@x.at','{"username":"xeno"}');
  update profiles set role='admin' where id=admx; update profiles set role='ceo' where id=ceox;

  -- Bundesländer und Bezirke
  assert (select count(*) from regions)=9 and (select count(*) from districts)=116, 'geo seed 9 regions / 116 districts';
  assert (select array_agg(id order by sort) from regions where active)=array['wien','noe'], 'Wien and Niederösterreich active';
  assert (select count(*) from districts where region_id='wien')=23 and (select count(*) from districts where region_id='noe')=24, 'district counts Wien 23, NÖ 24';
  assert (select name from districts where id=7)='Neubau' and (select code from districts where id=7)='1070', 'Wien keeps ids 1-23';
  assert (select count(distinct id) from districts)=116 and not exists (select 1 from districts d join regions r on r.id=d.region_id where d.id/100 <> (r.sort-1) and r.id<>'wien'), 'id ranges per region';
  perform t.as_(null);
  assert (select count(*) from districts)=116 and (select count(*) from regions)=9, 'guests read geo data';
  assert t.fails($q$insert into districts(id,region_id,name,sort) values (999,'wien','x',1)$q$), 'guests cannot add districts';
  reset role;
  perform t.as_(x1);
  assert t.fails($q$insert into districts(id,region_id,name,sort) values (999,'wien','x',1)$q$), 'members cannot add districts';
  insert into spots(user_id,model_id,color,district) values (x1,'laferrari','red',101) returning id into s1;
  assert t.fails($q$insert into spots(user_id,model_id,color,district) values (auth.uid(),'laferrari','red',201)$q$), 'closed region refused';
  assert t.fails($q$insert into spots(user_id,model_id,color,district) values (auth.uid(),'laferrari','red',999)$q$), 'unknown district refused';
  update regions set active=true where id='bgld'; get diagnostics n = row_count; assert n=0, 'member cannot open a region';
  reset role;
  perform t.as_(admx);
  update regions set active=true where id='bgld'; get diagnostics n = row_count; assert n=0, 'admin cannot open a region';
  reset role;
  perform t.as_(ceox);
  update regions set active=true where id='bgld'; get diagnostics n = row_count; assert n=1, 'CEO opens a region';
  assert t.fails($q$update regions set name='x' where id='bgld'$q$), 'only the active flag is writable';
  reset role;
  perform t.as_(x1); insert into spots(user_id,model_id,color,district) values (x1,'laferrari','blue',201) returning id into s2; reset role;
  perform t.as_(ceox); update regions set active=false where id='bgld'; reset role;
  assert (select active from regions where id='bgld')=false, 'region closed again';
  update spots set status='approved' where id in (s1,s2);
  perform t.as_(x2);
  assert t.fails(format($q$insert into spot_marks(spot_id,user_id,district) values (%s,auth.uid(),201)$q$, s1)), 'sighting in closed region refused';
  insert into spot_marks(spot_id,user_id,district) values (s1,x2,105);
  assert t.fails(format($q$insert into spot_edits(spot_id,user_id,district) values (%s,auth.uid(),201)$q$, s1)), 'edit into closed region refused';
  insert into spot_edits(spot_id,user_id,district) values (s1,x2,106);
  reset role;
  raise notice 'PASS regions';

  -- Auto des Monats
  assert not exists (select 1 from car_of_month), 'no car of the month without likes';
  perform t.as_(x2); insert into likes(user_id,spot_id) values (x2,s1); reset role;
  perform t.as_(x3); insert into likes(user_id,spot_id) values (x3,s1),(x3,s2); reset role;
  perform t.as_(null);
  assert (select spot_id from car_of_month)=s1 and (select likes from car_of_month)=2, 'most likes this month wins';
  reset role;
  delete from likes;
  insert into likes(user_id,spot_id,created_at) values (x2,s2,prevm),(x3,s2,prevm);
  assert (select spot_id from car_of_month)=s2 and (select likes from car_of_month)=2, 'falls back to last month';
  insert into likes(user_id,spot_id) values (x4,s1);
  assert (select spot_id from car_of_month)=s1 and (select likes from car_of_month)=1, 'this month beats last month';
  update spots set status='pending' where id=s1;
  assert (select spot_id from car_of_month)=s2 and (select likes from car_of_month)=2, 'pending cars never qualify (last month of the other car wins)';
  update spots set status='pending' where id=s2;
  assert not exists (select 1 from car_of_month), 'nothing qualifies without approved cars';
  update spots set status='approved' where id=s2;
  update spots set status='approved' where id=s1;
  raise notice 'PASS car of the month';

  -- Zahlen für Abzeichen
  assert (select cars from profile_badge_stats where user_id=x1)=2, 'badge: cars';
  assert (select sightings from profile_badge_stats where user_id=x1)=2 and (select districts from profile_badge_stats where user_id=x1)=2
     and (select regions from profile_badge_stats where user_id=x1)=2, 'badge: sightings, districts, regions';
  assert (select cars from profile_badge_stats where user_id=x2)=0 and (select sightings from profile_badge_stats where user_id=x2)=1
     and (select regions from profile_badge_stats where user_id=x2)=1, 'badge: spotter without own cars';
  assert (select likes_received from profile_badge_stats where user_id=x1)=3, 'badge: likes received';
  perform t.as_(null); assert (select count(*) from profile_badge_stats)>=7, 'guests read badge numbers'; reset role;
  raise notice 'PASS badge numbers';

  -- Antworten und Erwähnungen
  perform t.as_(x2); insert into comments(spot_id,user_id,body) values (s1,x2,'Wow, schön @xavier @nobody123') returning id into c1; reset role;
  assert (select count(*) from notifications where user_id=x2 and text_en like '%mentioned%')=0, 'no note to yourself';
  perform t.as_(x3); insert into comments(spot_id,user_id,body,parent_id) values (s1,x3,'Stimmt! @xena schau mal',c1) returning id into c2; reset role;
  assert (select parent_id from comments where id=c2)=c1, 'reply stored';
  assert exists (select 1 from notifications where user_id=x2 and text_en='xander replied to your comment on Ferrari LaFerrari.'
                  and text_de='xander hat auf deinen Kommentar bei Ferrari LaFerrari geantwortet.'), 'reply note (en + de)';
  assert exists (select 1 from notifications where user_id=x1 and text_en='xander mentioned you in a comment on Ferrari LaFerrari.'
                  and text_de='xander hat dich in einem Kommentar bei Ferrari LaFerrari erwähnt.'), 'mention note (en + de)';
  perform t.as_(x4); insert into comments(spot_id,user_id,body,parent_id) values (s1,x4,'@xander danke und @XANDER nochmal',c2) returning id into c3; reset role;
  assert (select parent_id from comments where id=c3)=c1, 'reply to a reply hangs on the main comment';
  assert (select count(*) from notifications where user_id=x3 and text_en like 'xyla mentioned%')=1, 'one note per person, any spelling';
  select count(*) into n0 from notifications where user_id=x2 and text_en like 'xyla%';
  perform t.as_(x4); insert into comments(spot_id,user_id,body,parent_id) values (s1,x4,'@xavier ja',c1); reset role;
  assert (select count(*) from notifications where user_id=x2 and text_en like 'xyla%')=n0+1, 'reply + mention of the same person = one note';
  perform t.as_(x2);
  assert t.fails(format($q$insert into comments(spot_id,user_id,body,parent_id) values (%s,auth.uid(),'x',%s)$q$, s2, c1)), 'reply must belong to the same car';
  reset role;
  perform t.as_(x1); insert into comments(spot_id,user_id,body) values (s1,x1,'@xavier @xander @xyla @xadmin @xceo @xeno');
  reset role;
  assert (select count(*) from notifications where text_en like 'xena mentioned%')=5, 'at most 5 mentions per comment';
  perform t.as_(x2); insert into blocks(blocker_id,blocked_id) values (x2,x3); reset role;
  select count(*) into n from notifications where user_id=x2;
  perform t.as_(x3); insert into comments(spot_id,user_id,body,parent_id) values (s1,x3,'@xavier hallo',c1); reset role;
  assert (select count(*) from notifications where user_id=x2)=n, 'no note across a block';
  assert (select comments from profile_badge_stats where user_id=x3)=2, 'badge: comments';
  raise notice 'PASS replies and mentions';

  assert has_column_privilege('authenticated','public.regions','active','update') and not has_column_privilege('authenticated','public.regions','name','update'), 'regions: only active writable';
  assert not has_table_privilege('anon','public.regions','update'), 'guests cannot change regions';
  raise notice 'ALL ADDON TESTS PASSED';
end $$;
