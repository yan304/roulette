import type { SupabaseClient } from "@supabase/supabase-js";
import type { Participant, Spin } from "@/lib/types";

export function supabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

// Everything both the public and admin pages need to render the roulette.
export async function loadRoulette(supabase: SupabaseClient) {
  const [{ data: participants }, { data: spins }] = await Promise.all([
    supabase.from("participants").select("*").order("created_at"),
    supabase.from("spins").select("*").order("created_at", { ascending: false }).limit(10),
  ]);
  return {
    participants: (participants ?? []) as Participant[],
    recentSpins: (spins ?? []) as Spin[],
  };
}
