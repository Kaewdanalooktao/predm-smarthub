/* Pre-DM Smart Hub — backend config.
   supabaseAnonKey: Supabase Dashboard → Project Settings → API → "anon public" (or "Publishable") key.
   The anon key is meant to be used in the browser; data is protected by the Row Level Security rules in supabase/schema.sql.
   Leave it empty to run the app in local-only mode (data stays in this browser). */
window.PREDM_CONFIG = {
  supabaseUrl: "https://dusdtksazktyaafyeblj.supabase.co",
  supabaseAnonKey: "sb_publishable_Kd5hb3iSc40MV9G4ejy-fw_uRK1dY9A",
};
