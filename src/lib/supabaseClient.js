import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when env is set so cloud sync can run. */
export function isSupabaseConfigured() {
  return Boolean(url && anonKey && url.startsWith("http"));
}

let client;

/** @returns {import("@supabase/supabase-js").SupabaseClient | null} */
export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
