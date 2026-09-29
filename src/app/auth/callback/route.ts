import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registerParticipant } from "@/lib/register";

// Google redirects here (via Supabase) with a one-time code.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await registerParticipant(supabase, data.user);
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
