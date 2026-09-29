"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { joinRoulette, leaveRoulette, removeParticipant } from "@/app/actions";
import type { Participant, Spin } from "@/lib/types";
import { Avatar } from "@/components/Avatar";

type Props = {
  participants: Participant[];
  recentSpins: Spin[];
  userId: string | null;
  // "admin" shows the Spin and remove controls; "public" lets people join and watch.
  mode: "public" | "admin";
  // Admins browsing the public page shouldn't add their own name.
  viewerIsAdmin?: boolean;
};

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function RouletteDemo({ participants, recentSpins, userId, mode, viewerIsAdmin = false }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState<string[] | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  // Bumped on every jumble step so the reel re-animates even if a name repeats.
  const [tickCount, setTickCount] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Spin | null>(null);
  const [history, setHistory] = useState<Spin[]>(recentSpins);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Refs so the realtime callback always sees current values.
  const seenSpins = useRef(new Set(recentSpins.map((s) => s.id)));
  const spinningRef = useRef(false);
  const participantsRef = useRef(participants);
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const isRegistered = participants.some((p) => p.id === userId);

  // Show names in the jumbled order; anyone who joined mid-spin goes last.
  const byId = new Map(participants.map((p) => [p.id, p]));
  const displayed = order
    ? [
        ...order.flatMap((id) => byId.get(id) ?? []),
        ...participants.filter((p) => !order.includes(p.id)),
      ]
    : participants;

  // Jumble the names faster-then-slower, then land on the winner.
  function animateTo(spin: Spin) {
    if (seenSpins.current.has(spin.id)) return;
    seenSpins.current.add(spin.id);

    const finish = () => {
      setHighlight(spin.winner_id);
      setWinner(spin);
      setHistory((h) => [spin, ...h].slice(0, 10));
    };

    const ids = participantsRef.current.map((p) => p.id);
    if (spinningRef.current || ids.length < 2) {
      finish();
      return;
    }

    spinningRef.current = true;
    setSpinning(true);
    setWinner(null);

    // ~30 steps over ~5.5s, starting fast and slowing to a crawl.
    let delay = 50;
    const tick = () => {
      setOrder(shuffle(ids));
      setHighlight(ids[Math.floor(Math.random() * ids.length)]);
      setTickCount((n) => n + 1);
      delay *= 1.08;
      if (delay < 520) {
        setTimeout(tick, delay);
      } else {
        spinningRef.current = false;
        setSpinning(false);
        finish();
      }
    };
    tick();
  }
  const animateRef = useRef(animateTo);
  useEffect(() => {
    animateRef.current = animateTo;
  });

  // Live updates: new names appear and spins play for everyone watching.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("roulette")
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () =>
        router.refresh(),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "spins" }, (payload) =>
        animateRef.current(payload.new as Spin),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    const t = setTimeout(() => document.getElementById("demo-spin")?.click(), 300);
    return () => clearTimeout(t);
  }, []);

  function spin() {
    setError(null);
    startTransition(async () => {
      const w = participants[3];
      const res = { error: undefined as string | undefined, spin: { id: Date.now(), winner_id: w.id, winner_name: w.name, winner_avatar_url: null, spun_by: null, created_at: new Date().toISOString() } };
      if (res.error) setError(res.error);
      else if (res.spin) animateTo(res.spin);
    });
  }

  function toggleMembership() {
    setError(null);
    startTransition(async () => {
      const res = await (isRegistered ? leaveRoulette() : joinRoulette());
      if (res.error) setError(res.error);
    });
  }

  function remove(p: Participant) {
    if (!confirm(`Remove ${p.name} from the roulette?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await removeParticipant(p.id);
      if (res.error) setError(res.error);
    });
  }

  const state = spinning ? "spinning" : winner ? "winner" : "idle";

  // The reel in the hero: the name under the highlight plus its neighbours
  // in the current jumbled order, shown faded above and below.
  const reelIds = order ?? participants.map((p) => p.id);
  const reelIndex = highlight ? reelIds.indexOf(highlight) : -1;
  const reelAt = (offset: number) =>
    reelIndex < 0 ? undefined : byId.get(reelIds[(reelIndex + offset + reelIds.length) % reelIds.length]);
  const reelCurrent = reelAt(0);

  return (
    <div className="flex w-full flex-col gap-8">
      <section
        data-state={state}
        className="stage glass relative flex min-h-[26rem] flex-col justify-between gap-10 overflow-hidden rounded-[2rem] p-6 sm:p-10"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="glass-pill rounded-full px-4 py-1.5">
            {spinning ? "Jumbling" : winner ? "Winner" : "Live draw"}
          </span>
          <span className="text-white/80">
            {participants.length} {participants.length === 1 ? "name" : "names"}
          </span>
        </div>

        {spinning && reelCurrent ? (
          <div className="reel flex flex-col gap-2" aria-hidden>
            <p className="reel-ghost truncate text-2xl font-light sm:text-3xl">{reelAt(-1)?.name}</p>
            <div key={tickCount} className="reel-in flex items-center gap-4">
              <Avatar name={reelCurrent.name} src={reelCurrent.avatar_url} size={56} />
              <p className="text-lift truncate text-5xl font-light leading-[1.1] tracking-tight sm:text-7xl">
                {reelCurrent.name}
              </p>
            </div>
            <p className="reel-ghost truncate text-2xl font-light sm:text-3xl">{reelAt(1)?.name}</p>
          </div>
        ) : winner ? (
          <div key={winner.id} className="winner-pop relative flex flex-col gap-5">
            <div className="burst" aria-hidden>
              {Array.from({ length: 28 }, (_, i) => (
                <span key={i} style={{ "--i": i } as React.CSSProperties} />
              ))}
            </div>
            <Avatar name={winner.winner_name} src={winner.winner_avatar_url} size={64} />
            <p className="winner-name text-lift text-5xl font-normal leading-[1.05] tracking-tight sm:text-7xl">
              {winner.winner_name}
            </p>
          </div>
        ) : (
          <p className="text-lift max-w-xl text-4xl font-light leading-[1.1] tracking-tight sm:text-5xl">
            {spinning
              ? "Jumbling the names…"
              : participants.length === 0
                ? "No names yet. Sign in to add yours."
                : "Who will the roulette pick next?"}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          {mode === "admin" ? (
            <button
              id="demo-spin"
              onClick={spin}
              disabled={spinning || pending || participants.length === 0}
              className="glass-pill rounded-full !border-white/70 !bg-white/30 px-8 py-2.5 font-medium text-white !shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_0_40px_rgb(45_212_191/0.4)] transition hover:!bg-white/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {spinning ? "Spinning…" : "Spin"}
            </button>
          ) : userId && !viewerIsAdmin ? (
            <>
              <button
                onClick={toggleMembership}
                disabled={spinning || pending}
                className="glass-pill rounded-full px-5 py-2.5 text-sm transition hover:brightness-125 disabled:opacity-40"
              >
                {isRegistered ? "Remove my name" : "Add my name"}
              </button>
              <span className="text-sm text-white/70">The host will spin when it&apos;s time.</span>
            </>
          ) : userId ? (
            <span className="text-sm text-white/80">Spin from the admin page.</span>
          ) : (
            <span className="text-sm text-white/80">Sign in with Google to join the draw</span>
          )}
          <span className="ml-auto hidden h-px w-40 bg-white/50 sm:block" aria-hidden />
        </div>
      </section>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <ul className="grid grid-cols-2 content-start gap-3 max-lg:empty:hidden sm:grid-cols-3">
          {displayed.map((p) => {
            const active = highlight === p.id;
            const isWinner = active && !spinning && winner?.winner_id === p.id;
            return (
              <li
                key={p.id}
                className={`glass flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-all duration-150 ${
                  isWinner
                    ? "scale-105 !border-teal-200/70 !bg-teal-400/25 !shadow-[0_0_40px_rgb(45_212_191/0.45)]"
                    : active
                      ? "scale-105 !border-indigo-300/60 !bg-indigo-500/25 !shadow-[0_0_24px_rgb(99_102_241/0.4)]"
                      : ""
                }`}
              >
                <Avatar name={p.name} src={p.avatar_url} size={28} />
                <span className="truncate text-sm">
                  {p.name}
                  {p.id === userId && <span className="text-white/50"> (you)</span>}
                </span>
                {mode === "admin" && (
                  <button
                    onClick={() => remove(p)}
                    disabled={spinning || pending}
                    aria-label={`Remove ${p.name}`}
                    className="ml-auto shrink-0 rounded-full px-1.5 text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <aside className="glass self-start rounded-3xl p-5">
          <h2 className="mb-4 text-sm text-white/60">Recent winners</h2>
          {history.length === 0 ? (
            <p className="text-sm text-white/50">No spins yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {history.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={s.winner_name} src={s.winner_avatar_url} size={24} />
                  <span className="truncate">{s.winner_name}</span>
                  <time className="ml-auto shrink-0 text-xs text-white/50">
                    {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}
