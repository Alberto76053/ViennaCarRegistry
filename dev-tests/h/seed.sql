insert into auth.users(id,email,raw_user_meta_data) values
 ('11111111-0000-0000-0000-000000000001','ana@x.at','{"username":"ana"}'),
 ('11111111-0000-0000-0000-000000000002','ben@x.at','{"username":"ben"}'),
 ('11111111-0000-0000-0000-000000000003','ada@x.at','{"username":"ada"}'),
 ('11111111-0000-0000-0000-000000000004','chief@x.at','{"username":"chief"}');
update public.profiles set is_pro = true where username = 'ben';
update public.profiles set role = 'admin' where username = 'ada';
update public.profiles set role = 'ceo' where username = 'chief';
-- freigegebene Spots
insert into public.spots(user_id,model_id,color,paint,district,status,approved_at) values
 ('11111111-0000-0000-0000-000000000002','laferrari','yellow','Giallo Modena',1,'approved',now()-interval '5 day'),
 ('11111111-0000-0000-0000-000000000002','huayra','blue',null,1,'approved',now()-interval '4 day'),
 ('11111111-0000-0000-0000-000000000001','svj','orange','Arancio Argos',2,'approved',now()-interval '3 day'),
 ('11111111-0000-0000-0000-000000000001','918','white','Martini Racing (Weissach)',19,'approved',now()-interval '2 day'),
 ('11111111-0000-0000-0000-000000000002','p1','grey',null,3,'approved',now()-interval '1 day');
insert into public.spots(user_id,model_id,color,paint,district,kind,arch_kind,status,approved_at) values
 ('11111111-0000-0000-0000-000000000002','amgone','silver','Hightech Silver Magno',1,'archive','visit','approved',now());
insert into public.spot_details(spot_id,prod_no) select id, (id*37)::text from public.spots;
insert into public.spot_photos(spot_id,path,position) select id, '11111111-0000-0000-0000-000000000002/'||id||'-a.jpg', 0 from public.spots;
insert into public.spot_photos(spot_id,path,position) select id, '11111111-0000-0000-0000-000000000002/'||id||'-b.jpg', 1 from public.spots where id in (1,2);
-- ein wartender Spot von ana
insert into public.spots(user_id,model_id,color,district,status) values ('11111111-0000-0000-0000-000000000001','valkyrie','green',7,'pending');
insert into public.spot_photos(spot_id,path,position) values (7,'11111111-0000-0000-0000-000000000001/7-a.jpg',0);
insert into public.events(title,starts_on,place,district,description) values ('Cars & coffee morning','2027-05-08','Donaustadt',22,'Example event.');
