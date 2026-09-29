export function SetupNeeded() {
  return (
    <main className="glass mx-auto mt-16 max-w-xl rounded-3xl p-8 text-white/80">
      <h1 className="mb-4 text-3xl font-light text-white">Setup needed</h1>
      <p>
        Copy <code>.env.local.example</code> to <code>.env.local</code>, fill in your Supabase URL
        and key, then restart the dev server.
      </p>
    </main>
  );
}
