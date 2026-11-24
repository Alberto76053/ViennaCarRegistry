-- Update 2: Autos hochladen, Spotter markieren sie als "gespottet" und schlagen Änderungen vor.
-- Nur nötig, wenn du schema.sql schon früher ausgeführt hast. Ein frisches Projekt braucht nur schema.sql.
-- Im Supabase SQL Editor einfügen und ausführen. Mehrfaches Ausführen schadet nicht.

begin;

-- Sichtungen: Mitglieder markieren ein hochgeladenes Auto als "gespottet".
-- Wer ein Auto gespottet hat, darf Änderungen vorschlagen (siehe spot_edits).
create table if not exists public.spot_marks (
  id         bigint generated always as identity primary key,
  spot_id    bigint not null references public.spots(id) on delete cascade,
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  district   int    not null check (district between 1 and 23),
  spotted_on date   not null default current_date,
  created_at timestamptz not null default now(),
  unique (spot_id, user_id, spotted_on)
);
create index if not exists spot_marks_spot_idx on public.spot_marks (spot_id, spotted_on desc);


alter table public.spot_marks enable row level security;

-- bereits vorhandene Autos: der Uploader gilt als erster Spotter (Bezirk und Datum des Autos)
insert into public.spot_marks (spot_id, user_id, district, spotted_on)
  select s.id, s.user_id, s.district, coalesce(d.spotted_on, s.created_at::date)
    from public.spots s left join public.spot_details d on d.spot_id = s.id
  on conflict (spot_id, user_id, spotted_on) do nothing;

create or replace function public.spots_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare mname text; pro boolean;
begin
  select brand || ' ' || name into mname from public.models where id = new.model_id;
  select is_pro into pro from public.profiles where id = new.user_id;
  -- wer ein Auto hochlädt, hat es auch gespottet
  insert into public.spot_marks (spot_id, user_id, district) values (new.id, new.user_id, new.district);
  perform public.notify(new.user_id,
    format('Your car (%s) is waiting for review.%s', mname, case when pro then ' Pro: reviewed first.' else '' end),
    format('Dein Auto (%s) wartet auf Freigabe.%s',  mname, case when pro then ' Pro: wird zuerst geprüft.' else '' end));
  return new;
end $$;

drop trigger if exists spots_after_insert on public.spots;
create trigger spots_after_insert after insert on public.spots
  for each row execute function public.spots_after_insert();

create or replace function public.spots_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare mname text;
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    select brand || ' ' || name into mname from public.models where id = new.model_id;
    if new.status = 'approved' then
      perform public.notify(new.user_id, format('Your car (%s) was approved.', mname),
                                         format('Dein Auto (%s) wurde freigegeben.', mname));
    else
      perform public.notify(new.user_id, format('Your car (%s) was not accepted.', mname),
                                         format('Dein Auto (%s) wurde nicht angenommen.', mname));
    end if;
  end if;
  return new;
end $$;

-- Neue Markierung: jüngste Sichtung bestimmt Bezirk und Datum des Autos; der Uploader wird informiert
create or replace function public.marks_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record; mname text; uname text;
begin
  select * into s from public.spots where id = new.spot_id;
  if not exists (select 1 from public.spot_marks m
                  where m.spot_id = new.spot_id and m.id <> new.id and m.spotted_on > new.spotted_on) then
    update public.spots        set district   = new.district   where id = new.spot_id;
    update public.spot_details set spotted_on = new.spotted_on where spot_id = new.spot_id;
  end if;
  if new.user_id <> s.user_id then
    select brand || ' ' || name into mname from public.models   where id = s.model_id;
    select username            into uname from public.profiles where id = new.user_id;
    perform public.notify(s.user_id, format('%s spotted your %s.', uname, mname),
                                     format('%s hat dein Auto (%s) gespottet.', uname, mname));
  end if;
  return new;
end $$;

drop trigger if exists marks_after_insert on public.spot_marks;
create trigger marks_after_insert after insert on public.spot_marks
  for each row execute function public.marks_after_insert();

-- spot_marks: Mitglieder sehen die Sichtungen sichtbarer Autos und markieren freigegebene Autos
drop policy if exists marks_read on public.spot_marks;
create policy marks_read on public.spot_marks for select to authenticated
  using (exists (select 1 from public.spots s where s.id = spot_id));
drop policy if exists marks_insert on public.spot_marks;
create policy marks_insert on public.spot_marks for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned()
    and spotted_on <= current_date + 1 and spotted_on >= current_date - 30
    and exists (select 1 from public.spots s where s.id = spot_id and s.status = 'approved'));

-- spot_edits: Änderungswünsche dürfen der Uploader und alle, die das Auto gespottet haben
drop policy if exists edits_insert on public.spot_edits;
create policy edits_insert on public.spot_edits for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned() and (
       exists (select 1 from public.spots s where s.id = spot_id and s.user_id = auth.uid())
    or exists (select 1 from public.spot_marks m where m.spot_id = spot_edits.spot_id and m.user_id = auth.uid())));

commit;
