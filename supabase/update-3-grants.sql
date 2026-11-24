-- Update 3: Tabellenrechte für die API
-- Nur nötig, wenn deine Datenbank vor diesem Stand eingerichtet wurde und die Seite
-- "permission denied" / "Das darfst du nicht" meldet. Im SQL Editor ausführen. Mehrfach ausführbar.
-- (Neue Einrichtungen mit schema.sql haben das schon.)

-- Neue Supabase-Projekte geben anon/authenticated auf neuen Tabellen KEINE Rechte mehr.
-- Ohne diese Zeilen antwortet die API mit "permission denied", obwohl die Policies stimmen.
-- Die Policies oben entscheiden danach, welche Zeilen sichtbar/änderbar sind.
-- Neue Tabelle später? Dann hier ein grant ergänzen (und RLS + Policy nicht vergessen).

revoke all on all tables in schema public from anon, authenticated;

-- Gäste: nur lesen, nur was öffentlich sein darf
grant select on public.models, public.model_colors, public.spots, public.spot_photos,
  public.profiles, public.events, public.follows, public.garage to anon;
grant select on public.spot_stats, public.profile_stats to anon, authenticated;
-- Die Auto-Seite fragt für Gäste auch diese Tabellen ab. Ihre Policies gelten nur für
-- Angemeldete und liefern Gästen deshalb 0 Zeilen (statt eines Fehlers "permission denied").
grant select on public.spot_details, public.comments, public.spot_marks to anon;

-- Angemeldete: genau die Rechte, die die Policies vorsehen
grant select on public.user_status, public.model_specs to authenticated;
grant select, insert on public.admin_applications, public.model_requests, public.reports,
  public.spot_edits, public.spot_marks, public.messages to authenticated;
grant select, insert, delete on public.blocks, public.comments, public.favorites, public.follows,
  public.garage, public.likes to authenticated;
grant select, insert on public.spot_details, public.spot_photos to authenticated;
grant select, update on public.profiles to authenticated;
-- Benachrichtigungen: nur das Gelesen-Häkchen darf geändert werden, nie der Text
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;
grant select, insert, update, delete on public.spots, public.events, public.models,
  public.model_colors, public.model_specs to authenticated;
grant select on public.models, public.model_colors, public.events to authenticated;
-- Zähler für automatisch vergebene IDs
grant usage, select on all sequences in schema public to authenticated;
-- bad_words bekommt bewusst kein Recht: nur Trigger und Admin im Dashboard lesen es.

-- Der Server-Schlüssel (service_role) umgeht RLS und darf alles; er gehört nie in die Website.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
