"use client";

import { useActionState } from "react";
import { adminSignIn } from "@/app/actions";

export function AdminLogin({ signedInAs }: { signedInAs: string | null }) {
  const [state, formAction, pending] = useActionState(adminSignIn, undefined);

  return (
    <form action={formAction} className="glass mx-auto flex w-full max-w-sm flex-col gap-4 rounded-3xl p-8">
      <div>
        <h1 className="text-3xl font-light">Admin login</h1>
        <p className="mt-1 text-sm text-white/70">Only admins can spin the roulette.</p>
      </div>

      {signedInAs && (
        <p className="text-sm text-white/70">
          You&apos;re signed in as {signedInAs}, which isn&apos;t an admin. Signing in here switches
          accounts.
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="glass-pill rounded-xl !bg-slate-950/30 px-4 py-2.5 text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-teal-300/50"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="glass-pill rounded-xl !bg-slate-950/30 px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-teal-300/50"
        />
      </label>

      {state?.error && <p className="text-sm text-rose-300">{state.error}</p>}

      <button
        disabled={pending}
        className="glass-pill mt-2 rounded-full !border-white/70 !bg-white/30 px-6 py-2.5 font-medium transition hover:!bg-white/40 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
