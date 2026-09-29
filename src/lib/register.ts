import type { SupabaseClient, User } from "@supabase/supabase-js";

// Adds (or refreshes) the signed-in user's name using their Google profile.
export async function registerParticipant(supabase: SupabaseClient, user: User) {
  const meta = user.user_metadata ?? {};
  const name: string =
    meta.full_name || meta.name || user.email?.split("@")[0] || "Anonymous";

  return supabase.from("participants").upsert({
    id: user.id,
    name,
    email: user.email ?? null,
    avatar_url: meta.avatar_url || meta.picture || null,
  });
}
