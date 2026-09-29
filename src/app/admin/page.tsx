import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { loadRoulette, supabaseConfigured } from "@/lib/roulette-data";
import { AdminLogin } from "@/components/AdminLogin";
import { Roulette } from "@/components/Roulette";
import { SetupNeeded } from "@/components/SetupNeeded";

export const metadata: Metadata = {
  title: "Admin · Name Roulette",
  robots: { index: false },
};

export default async function AdminPage() {
  if (!supabaseConfigured()) return <SetupNeeded />;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const admin = user ? await isAdmin(supabase) : false;

  if (!user || !admin) {
    return (
      <main className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
        <AdminLogin signedInAs={user?.email ?? null} />
        <Link href="/" className="text-sm text-white/60 hover:text-white">
          ← Back to the roulette
        </Link>
      </main>
    );
  }

  const data = await loadRoulette(supabase);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="glass-pill rounded-full px-4 py-1.5 text-sm transition hover:brightness-125">
            Name Roulette
          </Link>
          <span className="rounded-full border border-teal-300/50 bg-teal-400/15 px-3 py-1 text-xs uppercase tracking-widest text-teal-100">
            Admin
          </span>
        </div>
        <form action="/auth/signout" method="post" className="flex items-center gap-3 text-sm">
          <input type="hidden" name="next" value="/admin" />
          <span className="hidden text-white/70 sm:inline">{user.email}</span>
          <button className="glass-pill rounded-full px-4 py-1.5 transition hover:brightness-125">
            Sign out
          </button>
        </form>
      </header>

      <Roulette {...data} userId={user.id} mode="admin" />
    </main>
  );
}
