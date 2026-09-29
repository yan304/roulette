import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const form = await request.formData();
  const next = form.get("next") === "/admin" ? "/admin" : "/";
  return NextResponse.redirect(new URL(next, request.url), { status: 303 });
}
