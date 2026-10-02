"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registerParticipant } from "@/lib/register";
import { isAdmin } from "@/lib/admin";
import type { Spin } from "@/lib/types";

export async function joinRoulette() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "You must be signed in." };

  const { error } = await registerParticipant(supabase, data.user);
  revalidatePath("/");
  return { error: error?.message };
}

export async function leaveRoulette() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("participants")
    .delete()
    .eq("id", data.user.id);
  revalidatePath("/");
  return { error: error?.message };
}

// The winner is chosen inside Postgres (see supabase/schema.sql) so every
// browser sees the same result and nobody can rig it from the client.
// spin() itself rejects non-admins; the check here just gives a clear message.
export async function spinRoulette(
  excludeWinners = false,
  winnerCount = 1,
): Promise<{ spins?: Spin[]; error?: string }> {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) return { error: "Only an admin can spin." };

  const { data, error } = await supabase.rpc("spin", {
    exclude_winners: excludeWinners,
    winner_count: winnerCount,
  });
  if (error) return { error: error.message };
  return { spins: data as Spin[] };
}

// Admin-only: add people by name, without a Google account. Accepts several
// names, one per line.
export async function addParticipants(input: string): Promise<{ error?: string; added?: number }> {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) return { error: "Only an admin can add names." };

  const seen = new Set<string>();
  const names = input
    .split("\n")
    .map((n) => n.trim().replace(/\s+/g, " ").slice(0, 60))
    .filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));

  if (names.length === 0) return { error: "Type at least one name." };
  if (names.length > 100) return { error: "Add at most 100 names at a time." };

  const { error } = await supabase
    .from("participants")
    .insert(names.map((name) => ({ name, manual: true })));
  revalidatePath("/");
  revalidatePath("/admin");
  return { error: error?.message, added: error ? 0 : names.length };
}

export async function removeParticipant(id: string) {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) return { error: "Only an admin can remove names." };

  const { error } = await supabase.from("participants").delete().eq("id", id);
  revalidatePath("/");
  revalidatePath("/admin");
  return { error: error?.message };
}

// Admin-only: remove every name and all spin history (see supabase/schema.sql).
export async function resetRoulette() {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) return { error: "Only an admin can reset the roulette." };

  const { error } = await supabase.rpc("reset_roulette");
  revalidatePath("/");
  revalidatePath("/admin");
  return { error: error?.message };
}

export async function adminSignIn(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Invalid email or password." };

  // A valid login that isn't an admin gets signed straight back out.
  if (!(await isAdmin(supabase))) {
    await supabase.auth.signOut();
    return { error: "This account is not an admin." };
  }

  redirect("/admin");
}
