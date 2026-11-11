/* Pre-DM Smart Hub — backend config.
   supabaseAnonKey: Supabase Dashboard → Project Settings → API → "anon public" (or "Publishable") key.
   The anon key is meant to be used in the browser; data is protected by the Row Level Security rules in supabase/schema.sql.
   Leave it empty to run the app in local-only mode (data stays in this browser). */
window.PREDM_CONFIG = {
  supabaseUrl: "https://dusdtksazktyaafyeblj.supabase.co",
  supabaseAnonKey: "sb_publishable_Kd5hb3iSc40MV9G4ejy-fw_uRK1dY9A",
  // Privacy mode: false = never send photos to Google Gemini (AI body image / food photo recognition are hidden).
  // Body transformation still works with on-device reshaping, and food is picked from the cupboard.
  externalAI: false,
  // Video call network discovery (STUN). STUN only tells each device its public internet address so the two can find
  // each other; it never sees picture, sound, chat or health data. Replace with your own server (e.g. coturn) to keep
  // even this inside the organisation, or use [] to allow calls only on the same local network.
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.cloudflare.com:3478" }],
  // LINE Official Account for reminders: the basic ID shown in LINE Official Account Manager, e.g. "@123abcde".
  // Leave empty to hide the LINE connection. Setup steps: supabase/LINE_SETUP.md
  lineOaId: "@405uxbox",
  // "Sign in with LINE": the Channel ID (numbers) of the LINE Login channel (LINE Developers → Basic settings).
  // The Channel ID is public; the Channel secret is NOT and lives only in Supabase. Empty = hide the button.
  // Setup steps: deploy/line-setup/LINE-LOGIN-วิธีตั้งค่า.md
  lineLoginChannelId: "2012550959",
  // Admin page sign-in. false = email + password only. true = also a one-time code sent by email (safer).
  // The database must match: false → run supabase/admin_password_only.sql · true → run supabase/admin_otp.sql
  adminEmailCode: false,
  // Who people contact about their personal data (shown on the PDPA page), e.g. "รพ.สต. … โทร 0xx-xxx-xxxx".
  privacyContact: "",
};
