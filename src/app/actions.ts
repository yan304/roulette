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
export async function spinRoulette(): Promise<{ spin?: Spin; error?: string }> {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) return { error: "Only an admin can spin." };

  const { data, error } = await supabase.rpc("spin");
  if (error) return { error: error.message };
  return { spin: data as Spin };
}

export async function removeParticipant(id: string) {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) return { error: "Only an admin can remove names." };

  const { error } = await supabase.from("participants").delete().eq("id", id);
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
