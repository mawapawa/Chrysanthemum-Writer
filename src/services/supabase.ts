import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof console !== "undefined") {
      console.warn("[SUPABASE] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — Supabase client will be null.");
    }
    return null;
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = createSupabaseClient();
