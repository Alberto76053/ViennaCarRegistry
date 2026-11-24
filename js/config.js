// =====================================================================
// Hier trägst du die Zugangsdaten deines Supabase-Projekts ein.
// Supabase-Dashboard -> Project Settings -> API:
//   "Project URL"  -> SUPABASE_URL
//   "anon public"  -> SUPABASE_ANON_KEY   (dieser Key darf öffentlich sein)
// Den "service_role"-Key trägst du hier NIEMALS ein.
// =====================================================================
export const SUPABASE_URL = 'https://DEIN-PROJEKT.supabase.co';
export const SUPABASE_ANON_KEY = 'DEIN-ANON-KEY';

// Anmelden mit Google / Apple: erst im Supabase-Dashboard einrichten
// (Authentication -> Providers), dann hier eintragen, z. B. ['google'] oder ['google', 'apple'].
export const OAUTH_PROVIDERS = [];
