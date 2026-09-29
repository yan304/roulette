import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { loadRoulette, supabaseConfigured } from "@/lib/roulette-data";
import { Roulette } from "@/components/Roulette";
import { SetupNeeded } from "@/components/SetupNeeded";
import { SignInButton } from "@/components/SignInButton";

export default async function Home({ searchParams }: PageProps<"/">) {
  if (!supabaseConfigured()) return <SetupNeeded />;

  const supabase = await createClient();
  const [{ data: userData }, data, params] = await Promise.all([
    supabase.auth.getUser(),
    loadRoulette(supabase),
    searchParams,
  ]);
  const user = userData.user;
  const viewerIsAdmin = user ? await isAdmin(supabase) : false;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="glass-pill rounded-full px-4 py-1.5 text-sm font-normal">
          Name Roulette
        </h1>
        {user ? (
          <form action="/auth/signout" method="post" className="flex items-center gap-3 text-sm">
            <span className="hidden text-white/70 sm:inline">{user.email}</span>
            {viewerIsAdmin && (
              <Link href="/admin" className="glass-pill rounded-full px-4 py-1.5 transition hover:brightness-125">
                Admin
              </Link>
            )}
            <button className="glass-pill rounded-full px-4 py-1.5 transition hover:brightness-125">
              Sign out
            </button>
          </form>
        ) : (
          <SignInButton />
        )}
      </header>

      {params.error === "auth" && (
        <p className="glass rounded-2xl !border-rose-300/30 p-3 text-sm text-rose-200">
          Google sign-in failed. Please try again.
        </p>
      )}

      <Roulette
        {...data}
        userId={user?.id ?? null}
        mode="public"
        viewerIsAdmin={viewerIsAdmin}
      />
    </main>
  );
}
