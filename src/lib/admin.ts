import type { SupabaseClient } from "@supabase/supabase-js";

// Checked in the database (see is_admin() in supabase/schema.sql), so this
// can't be faked by the client.
export async function isAdmin(supabase: SupabaseClient) {
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}
