-- Update 4: Bundesländer und Bezirke, Antworten und @Erwähnungen, Auto des Monats, Abzeichen
-- Für Datenbanken, die vor diesem Stand eingerichtet wurden. Im SQL Editor ausführen.
-- Mehrfach ausführbar. Bestehende Autos und Sichtungen bleiben unverändert
-- (Wiener Bezirke behalten ihre Nummern 1 bis 23).

-- ---------------------------------------------------------------------
-- 1. Bundesländer und Bezirke
-- ---------------------------------------------------------------------
create table if not exists public.regions (
  id     text primary key,
  name   text not null,
  sort   int  not null,
  active boolean not null default false        -- nur in aktiven Bundesländern kann man Autos hochladen
);
create table if not exists public.districts (
  id        int primary key,                    -- Wien 1-23, Niederösterreich 101-124, Burgenland 201-209 usw.
  region_id text not null references public.regions(id),
  name      text not null,
  code      text,                               -- nur Wien: Postleitzahl (1010 ...)
  sort      int  not null
);
create index if not exists districts_region_idx on public.districts (region_id, sort);

-- Startdaten: 9 Bundesländer, 116 Bezirke (Wien und Niederösterreich sind aktiv)
insert into public.regions (id, name, sort, active) values
  ('wien', 'Wien', 1, true),
  ('noe', 'Niederösterreich', 2, true),
  ('bgld', 'Burgenland', 3, false),
  ('ktn', 'Kärnten', 4, false),
  ('ooe', 'Oberösterreich', 5, false),
  ('sbg', 'Salzburg', 6, false),
  ('stmk', 'Steiermark', 7, false),
  ('tirol', 'Tirol', 8, false),
  ('vbg', 'Vorarlberg', 9, false)
on conflict (id) do nothing;

insert into public.districts (id, region_id, name, code, sort) values
  (1, 'wien', 'Innere Stadt', '1010', 1),
  (2, 'wien', 'Leopoldstadt', '1020', 2),
  (3, 'wien', 'Landstraße', '1030', 3),
  (4, 'wien', 'Wieden', '1040', 4),
  (5, 'wien', 'Margareten', '1050', 5),
  (6, 'wien', 'Mariahilf', '1060', 6),
  (7, 'wien', 'Neubau', '1070', 7),
  (8, 'wien', 'Josefstadt', '1080', 8),
  (9, 'wien', 'Alsergrund', '1090', 9),
  (10, 'wien', 'Favoriten', '1100', 10),
  (11, 'wien', 'Simmering', '1110', 11),
  (12, 'wien', 'Meidling', '1120', 12),
  (13, 'wien', 'Hietzing', '1130', 13),
  (14, 'wien', 'Penzing', '1140', 14),
  (15, 'wien', 'Rudolfsheim-Fünfhaus', '1150', 15),
  (16, 'wien', 'Ottakring', '1160', 16),
  (17, 'wien', 'Hernals', '1170', 17),
  (18, 'wien', 'Währing', '1180', 18),
  (19, 'wien', 'Döbling', '1190', 19),
  (20, 'wien', 'Brigittenau', '1200', 20),
  (21, 'wien', 'Floridsdorf', '1210', 21),
  (22, 'wien', 'Donaustadt', '1220', 22),
  (23, 'wien', 'Liesing', '1230', 23),
  (101, 'noe', 'Amstetten', null, 1),
  (102, 'noe', 'Baden', null, 2),
  (103, 'noe', 'Bruck an der Leitha', null, 3),
  (104, 'noe', 'Gänserndorf', null, 4),
  (105, 'noe', 'Gmünd', null, 5),
  (106, 'noe', 'Hollabrunn', null, 6),
  (107, 'noe', 'Horn', null, 7),
  (108, 'noe', 'Korneuburg', null, 8),
  (109, 'noe', 'Krems (Land)', null, 9),
  (110, 'noe', 'Krems an der Donau (Stadt)', null, 10),
  (111, 'noe', 'Lilienfeld', null, 11),
  (112, 'noe', 'Melk', null, 12),
  (113, 'noe', 'Mistelbach', null, 13),
  (114, 'noe', 'Mödling', null, 14),
  (115, 'noe', 'Neunkirchen', null, 15),
  (116, 'noe', 'Scheibbs', null, 16),
  (117, 'noe', 'St. Pölten (Land)', null, 17),
  (118, 'noe', 'St. Pölten (Stadt)', null, 18),
  (119, 'noe', 'Tulln', null, 19),
  (120, 'noe', 'Waidhofen an der Thaya', null, 20),
  (121, 'noe', 'Waidhofen an der Ybbs (Stadt)', null, 21),
  (122, 'noe', 'Wiener Neustadt (Land)', null, 22),
  (123, 'noe', 'Wiener Neustadt (Stadt)', null, 23),
  (124, 'noe', 'Zwettl', null, 24),
  (201, 'bgld', 'Eisenstadt (Stadt)', null, 1),
  (202, 'bgld', 'Eisenstadt-Umgebung', null, 2),
  (203, 'bgld', 'Güssing', null, 3),
  (204, 'bgld', 'Jennersdorf', null, 4),
  (205, 'bgld', 'Mattersburg', null, 5),
  (206, 'bgld', 'Neusiedl am See', null, 6),
  (207, 'bgld', 'Oberpullendorf', null, 7),
  (208, 'bgld', 'Oberwart', null, 8),
  (209, 'bgld', 'Rust (Stadt)', null, 9),
  (301, 'ktn', 'Feldkirchen', null, 1),
  (302, 'ktn', 'Hermagor', null, 2),
  (303, 'ktn', 'Klagenfurt am Wörthersee (Stadt)', null, 3),
  (304, 'ktn', 'Klagenfurt-Land', null, 4),
  (305, 'ktn', 'Sankt Veit an der Glan', null, 5),
  (306, 'ktn', 'Spittal an der Drau', null, 6),
  (307, 'ktn', 'Villach (Stadt)', null, 7),
  (308, 'ktn', 'Villach-Land', null, 8),
  (309, 'ktn', 'Völkermarkt', null, 9),
  (310, 'ktn', 'Wolfsberg', null, 10),
  (401, 'ooe', 'Braunau am Inn', null, 1),
  (402, 'ooe', 'Eferding', null, 2),
  (403, 'ooe', 'Freistadt', null, 3),
  (404, 'ooe', 'Gmunden', null, 4),
  (405, 'ooe', 'Grieskirchen', null, 5),
  (406, 'ooe', 'Kirchdorf an der Krems', null, 6),
  (407, 'ooe', 'Linz (Stadt)', null, 7),
  (408, 'ooe', 'Linz-Land', null, 8),
  (409, 'ooe', 'Perg', null, 9),
  (410, 'ooe', 'Ried im Innkreis', null, 10),
  (411, 'ooe', 'Rohrbach', null, 11),
  (412, 'ooe', 'Schärding', null, 12),
  (413, 'ooe', 'Steyr (Stadt)', null, 13),
  (414, 'ooe', 'Steyr-Land', null, 14),
  (415, 'ooe', 'Urfahr-Umgebung', null, 15),
  (416, 'ooe', 'Vöcklabruck', null, 16),
  (417, 'ooe', 'Wels (Stadt)', null, 17),
  (418, 'ooe', 'Wels-Land', null, 18),
  (501, 'sbg', 'Hallein', null, 1),
  (502, 'sbg', 'Salzburg (Stadt)', null, 2),
  (503, 'sbg', 'Salzburg-Umgebung', null, 3),
  (504, 'sbg', 'St. Johann im Pongau', null, 4),
  (505, 'sbg', 'Tamsweg', null, 5),
  (506, 'sbg', 'Zell am See', null, 6),
  (601, 'stmk', 'Bruck-Mürzzuschlag', null, 1),
  (602, 'stmk', 'Deutschlandsberg', null, 2),
  (603, 'stmk', 'Graz (Stadt)', null, 3),
  (604, 'stmk', 'Graz-Umgebung', null, 4),
  (605, 'stmk', 'Hartberg-Fürstenfeld', null, 5),
  (606, 'stmk', 'Leibnitz', null, 6),
  (607, 'stmk', 'Leoben', null, 7),
  (608, 'stmk', 'Liezen', null, 8),
  (609, 'stmk', 'Murau', null, 9),
  (610, 'stmk', 'Murtal', null, 10),
  (611, 'stmk', 'Südoststeiermark', null, 11),
  (612, 'stmk', 'Voitsberg', null, 12),
  (613, 'stmk', 'Weiz', null, 13),
  (701, 'tirol', 'Imst', null, 1),
  (702, 'tirol', 'Innsbruck (Stadt)', null, 2),
  (703, 'tirol', 'Innsbruck-Land', null, 3),
  (704, 'tirol', 'Kitzbühel', null, 4),
  (705, 'tirol', 'Kufstein', null, 5),
  (706, 'tirol', 'Landeck', null, 6),
  (707, 'tirol', 'Lienz', null, 7),
  (708, 'tirol', 'Reutte', null, 8),
  (709, 'tirol', 'Schwaz', null, 9),
  (801, 'vbg', 'Bludenz', null, 1),
  (802, 'vbg', 'Bregenz', null, 2),
  (803, 'vbg', 'Dornbirn', null, 3),
  (804, 'vbg', 'Feldkirch', null, 4)
on conflict (id) do nothing;

-- Bisherige Zahlen-Prüfung (1 bis 23) ersetzen: der Bezirk muss in der Tabelle districts stehen
alter table public.spots      drop constraint if exists spots_district_check;
alter table public.spot_marks drop constraint if exists spot_marks_district_check;
alter table public.spot_edits drop constraint if exists spot_edits_district_check;
alter table public.events     drop constraint if exists events_district_check;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_district_fkey') then
    alter table public.spots add constraint spots_district_fkey foreign key (district) references public.districts(id); end if;
  if not exists (select 1 from pg_constraint where conname = 'spot_marks_district_fkey') then
    alter table public.spot_marks add constraint spot_marks_district_fkey foreign key (district) references public.districts(id); end if;
  if not exists (select 1 from pg_constraint where conname = 'spot_edits_district_fkey') then
    alter table public.spot_edits add constraint spot_edits_district_fkey foreign key (district) references public.districts(id); end if;
  if not exists (select 1 from pg_constraint where conname = 'events_district_fkey') then
    alter table public.events add constraint events_district_fkey foreign key (district) references public.districts(id); end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Likes bekommen ein Datum (für "Auto des Monats"), Kommentare können Antworten sein
-- ---------------------------------------------------------------------
alter table public.likes add column if not exists created_at timestamptz not null default now();
alter table public.comments add column if not exists parent_id bigint references public.comments(id) on delete cascade;
create index if not exists comments_parent_idx on public.comments (parent_id);

-- ---------------------------------------------------------------------
-- 3. Funktionen und Trigger
-- ---------------------------------------------------------------------
-- Ist der Bezirk in einem aktiven Bundesland? (leer = ok)
create or replace function public.district_active(d int) returns boolean
language sql stable set search_path = public as $$
  select d is null or exists (
    select 1 from public.districts x join public.regions r on r.id = x.region_id
    where x.id = d and r.active)
$$;

-- Antwort muss zum selben Auto gehören; Antworten auf Antworten hängen am Hauptkommentar
create or replace function public.comment_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if new.parent_id is not null then
    select spot_id, parent_id into p from public.comments where id = new.parent_id;
    if not found or p.spot_id <> new.spot_id then
      raise exception 'Diese Antwort gehört zu einem anderen Auto.' using errcode = '23514';
    end if;
    if p.parent_id is not null then new.parent_id := p.parent_id; end if;
  end if;
  return new;
end $$;

drop trigger if exists comment_guard on public.comments;
create trigger comment_guard before insert on public.comments
  for each row execute function public.comment_guard();

-- Hinweis für die Person, auf die geantwortet wurde, und für alle mit @name (höchstens 5)
create or replace function public.comments_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare cname text; who text; r uuid; nm text; done uuid[] := array[new.user_id];
begin
  select m.brand || ' ' || m.name into cname
    from public.spots s join public.models m on m.id = s.model_id where s.id = new.spot_id;
  select username into who from public.profiles where id = new.user_id;
  if new.parent_id is not null then
    select user_id into r from public.comments where id = new.parent_id;
    if r is not null and not (r = any(done)) and not public.is_blocked_between(new.user_id, r) then
      perform public.notify(r, format('%s replied to your comment on %s.', who, cname),
                               format('%s hat auf deinen Kommentar bei %s geantwortet.', who, cname));
      done := done || r;
    end if;
  end if;
  for nm in select distinct lower(x[1]) from regexp_matches(new.body, '(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,20})', 'g') as x limit 5 loop
    select id into r from public.profiles where username = nm;
    if r is not null and not (r = any(done)) and not public.is_blocked_between(new.user_id, r) then
      perform public.notify(r, format('%s mentioned you in a comment on %s.', who, cname),
                               format('%s hat dich in einem Kommentar bei %s erwähnt.', who, cname));
      done := done || r;
    end if;
  end loop;
  return null;
end $$;

drop trigger if exists comments_after_insert on public.comments;
create trigger comments_after_insert after insert on public.comments
  for each row execute function public.comments_after_insert();

revoke execute on function public.comment_guard(), public.comments_after_insert() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Ansichten (nur Zahlen)
-- ---------------------------------------------------------------------
-- Auto des Monats: meiste Likes im laufenden Monat (Wiener Zeit); gibt es dort noch keine, der Vormonat
create or replace view public.car_of_month as
  with b as (
    select (date_trunc('month', now() at time zone 'Europe/Vienna') at time zone 'Europe/Vienna') as cur_start,
           ((date_trunc('month', now() at time zone 'Europe/Vienna') - interval '1 month') at time zone 'Europe/Vienna') as prev_start
  ), c as (
    select s.id as spot_id,
           count(*) filter (where l.created_at >= b.cur_start) as cur_likes,
           count(*) filter (where l.created_at >= b.prev_start and l.created_at < b.cur_start) as prev_likes
      from public.spots s join public.likes l on l.spot_id = s.id cross join b
     where s.status = 'approved' and s.kind = 'registry'
     group by s.id
  ), w as (
    select exists (select 1 from c where cur_likes > 0) as use_cur
  )
  select c.spot_id,
         (case when w.use_cur then c.cur_likes else c.prev_likes end)::int as likes,
         (case when w.use_cur then (select cur_start from b) else (select prev_start from b) end) as month_start
    from c cross join w
   where (case when w.use_cur then c.cur_likes else c.prev_likes end) > 0
   order by 2 desc, c.spot_id
   limit 1;

-- Zahlen für die Abzeichen (nur freigegebene Autos zählen)
create or replace view public.profile_badge_stats as
  select p.id as user_id,
    (select count(*) from public.spots s where s.user_id = p.id and s.status = 'approved')::int as cars,
    (select count(*) from public.spot_marks m join public.spots s on s.id = m.spot_id
       where m.user_id = p.id and s.status = 'approved')::int as sightings,
    (select count(distinct m.district) from public.spot_marks m join public.spots s on s.id = m.spot_id
       where m.user_id = p.id and s.status = 'approved')::int as districts,
    (select count(distinct d.region_id) from public.spot_marks m join public.spots s on s.id = m.spot_id
       join public.districts d on d.id = m.district
       where m.user_id = p.id and s.status = 'approved')::int as regions,
    (select count(*) from public.likes l join public.spots s on s.id = l.spot_id
       where s.user_id = p.id and s.status = 'approved')::int as likes_received,
    (select count(*) from public.comments c where c.user_id = p.id)::int as comments
  from public.profiles p;

-- ---------------------------------------------------------------------
-- 5. Zugriffsregeln
-- ---------------------------------------------------------------------
alter table public.regions   enable row level security;
alter table public.districts enable row level security;

drop policy if exists regions_read on public.regions;
create policy regions_read on public.regions for select using (true);
-- Bundesländer freischalten oder sperren darf nur die CEO-Rolle
drop policy if exists regions_ceo_toggle on public.regions;
create policy regions_ceo_toggle on public.regions for update to authenticated
  using (public.is_ceo()) with check (public.is_ceo());
drop policy if exists districts_read on public.districts;
create policy districts_read on public.districts for select using (true);

-- Neue Autos, Sichtungen und Änderungsvorschläge nur in aktiven Bundesländern
drop policy if exists spots_insert on public.spots;
create policy spots_insert on public.spots for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and approved_at is null and not public.is_banned()
              and public.district_active(district));
drop policy if exists marks_insert on public.spot_marks;
create policy marks_insert on public.spot_marks for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned()
    and spotted_on <= current_date + 1 and spotted_on >= current_date - 30
    and public.district_active(district)
    and exists (select 1 from public.spots s where s.id = spot_id and s.status = 'approved'));
drop policy if exists edits_insert on public.spot_edits;
create policy edits_insert on public.spot_edits for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned() and public.district_active(district) and (
       exists (select 1 from public.spots s where s.id = spot_id and s.user_id = auth.uid())
    or exists (select 1 from public.spot_marks m where m.spot_id = spot_edits.spot_id and m.user_id = auth.uid())));

-- Rechte für die API
grant select on public.regions, public.districts to anon, authenticated;
grant update (active) on public.regions to authenticated;
grant select on public.car_of_month, public.profile_badge_stats to anon, authenticated;
grant all on public.regions, public.districts to service_role;

