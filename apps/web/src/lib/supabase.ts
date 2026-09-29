import { createClient } from "@supabase/supabase-js";
import type { Database } from "@mahallat/shared";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eaqmwmdkxqiuioszvjqx.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_BnEmLzPbhBBi_R-LmrXjXQ_zNLv8NEN";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
