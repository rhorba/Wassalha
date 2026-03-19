import { createClient } from "@supabase/supabase-js";

// Use placeholder values when env vars are missing (e.g. CI without Supabase).
// Prevents module-init crash during SSR; Realtime will silently be unavailable.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
);
