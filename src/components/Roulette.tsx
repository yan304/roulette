"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  joinRoulette,
  leaveRoulette,
  removeParticipant,
  spinRoulette,
} from "@/app/actions";
import type { Participant, Spin } from "@/lib/types";
import { useRouletteView } from "@/lib/use-roulette-view";
import { AddNamesForm } from "./AddNamesForm";
import { Wheel, type WheelSegment } from "./Wheel";

type Props = {
  participants: Participant[];
  recentSpins: Spin[];
  // Everyone who has ever won (not just the recent spins shown).
  wonIds: string[];
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

// How long a jumble takes: the sum of the growing delays between steps.
function spinDuration(stopAt: number) {
  let delay = 50;
  let total = 0;
  while ((delay *= 1.08) < stopAt) total += delay;
  return total;
}

export function Roulette({
  participants,
  recentSpins,
  wonIds,
  userId,
  mode,
  viewerIsAdmin = false,
}: Props) {
  const router = useRouter();
  const [order, setOrder] = useState<string[] | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  // Bumped on every jumble step so the reel re-animates even if a name repeats.
  const [tickCount, setTickCount] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Spin | null>(null);
  // Winners revealed so far in the current draw, and how many it will have.
  const [drawWinners, setDrawWinners] = useState<Spin[]>([]);
  const [drawTotal, setDrawTotal] = useState(1);
  // True from the start of a draw until its last winner is revealed.
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Spin[]>(recentSpins);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Admin option: only draw from people who haven't won yet.
  const [excludeWinners, setExcludeWinners] = useState(false);
  // Whether the spin being shown drew only from people who hadn't won.
  const [lastSpinExcluded, setLastSpinExcluded] = useState(false);
  // Admin option: how many different people one spin picks.
  const [winnerCount, setWinnerCount] = useState(1);
  // Reel or wheel; each viewer picks their own.
  const [view, setView] = useRouletteView();
  // Wheel layout from the last spin: slice order, everyone present at the
  // time, and the total rotation to land the winner under the pointer.
  const [wheel, setWheel] = useState<{
    ids: string[] | null;
    known: string[];
    rotation: number;
    duration: number;
  }>({ ids: null, known: [], rotation: 0, duration: 0 });

  // Refs so the realtime callback always sees current values.
  const seenSpins = useRef(new Set(recentSpins.map((s) => s.id)));
  // Winners waiting to be revealed, in order.
  const queueRef = useRef<Spin[]>([]);
  const busyRef = useRef(false);
  const currentDrawRef = useRef<string | null>(null);

  const isRegistered = participants.some((p) => p.id === userId);

  // Past winners, including any spins that happened since the page loaded.
  const wonSet = new Set([
    ...wonIds,
    ...history.flatMap((s) => (s.winner_id ? [s.winner_id] : [])),
  ]);
  const eligibleCount = participants.filter((p) => !wonSet.has(p.id)).length;
  const dimWinners = mode === "admin" ? excludeWinners : lastSpinExcluded;
  const maxWinners = Math.max(1, excludeWinners ? eligibleCount : participants.length);
  const effectiveCount = Math.min(winnerCount, maxWinners);

  // Show names in the jumbled order; anyone who joined mid-spin goes last.
  const byId = new Map(participants.map((p) => [p.id, p]));
  const displayed = order
    ? [
        ...order.flatMap((id) => byId.get(id) ?? []),
        ...participants.filter((p) => !order.includes(p.id)),
      ]
    : participants;

  // Queue a winner to be revealed. Winners from one draw arrive together and
  // play one after another; the short wait lets the whole draw arrive first.
  function enqueue(spin: Spin) {
    if (seenSpins.current.has(spin.id)) return;
    seenSpins.current.add(spin.id);
    queueRef.current.push(spin);
    if (!busyRef.current) {
      busyRef.current = true;
      setBusy(true);
      setTimeout(() => runNextRef.current(), 250);
    }
  }

  // Jumble the names faster-then-slower, then land on the next winner.
  function runNext() {
    const spin = queueRef.current.shift();
    if (!spin) {
      busyRef.current = false;
      setBusy(false);
      return;
    }

    const newDraw = !spin.draw_id || spin.draw_id !== currentDrawRef.current;
    const earlier = newDraw ? [] : drawWinners;
    currentDrawRef.current = spin.draw_id;
    if (newDraw) setDrawWinners([]);
    setDrawTotal(
      earlier.length + 1 + queueRef.current.filter((s) => s.draw_id && s.draw_id === spin.draw_id).length,
    );
    setLastSpinExcluded(spin.excluded_winners);

    const finish = () => {
      setSpinning(false);
      setHighlight(spin.winner_id);
      setWinner(spin);
      setDrawWinners((w) => [...w, spin]);
      setHistory((h) => [spin, ...h].slice(0, 10));
      // Let the reveal land before the next winner of this draw spins.
      setTimeout(() => runNextRef.current(), queueRef.current.length ? 2200 : 0);
    };

    // Jumble only the names this spin could have picked.
    const taken = new Set(earlier.map((s) => s.winner_id));
    const ids = participants
      .map((p) => p.id)
      .filter(
        (id) =>
          id === spin.winner_id ||
          (!taken.has(id) && (!spin.excluded_winners || !wonSet.has(id))),
      );
    if (ids.length < 2) {
      finish();
      return;
    }

    // ~30 steps over ~5.5s, starting fast and slowing to a crawl. Later
    // winners in the same draw spin a little shorter.
    const stopAt = earlier.length === 0 ? 520 : 360;

    // The wheel jumbles its slices, then turns at least 6 full times and
    // stops with the winner's slice (at a random spot within it) on top.
    const layout = shuffle(ids);
    const slice = 360 / layout.length;
    const index = layout.indexOf(spin.winner_id ?? "");
    const landAt =
      (((-(index + 0.5) * slice + (Math.random() - 0.5) * slice * 0.6) % 360) + 360) % 360;
    setWheel((w) => {
      const start = w.rotation + 360 * 6;
      const extra = (((landAt - start) % 360) + 360) % 360;
      return {
        ids: layout,
        known: participants.map((p) => p.id),
        rotation: start + extra,
        duration: spinDuration(stopAt),
      };
    });

    setSpinning(true);
    setWinner(null);

    let delay = 50;
    const tick = () => {
      setOrder(shuffle(ids));
      setHighlight(ids[Math.floor(Math.random() * ids.length)]);
      setTickCount((n) => n + 1);
      delay *= 1.08;
      if (delay < stopAt) {
        setTimeout(tick, delay);
      } else {
        finish();
      }
    };
    tick();
  }

  // Timers and the realtime callback call through refs so they always use
  // the latest render's state.
  const enqueueRef = useRef(enqueue);
  const runNextRef = useRef(runNext);
  useEffect(() => {
    enqueueRef.current = enqueue;
    runNextRef.current = runNext;
  });

  // Live updates: new names appear and spins play for everyone watching.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("roulette")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "spins" },
        (payload) => enqueueRef.current(payload.new as Spin),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  function spin() {
    setError(null);
    startTransition(async () => {
      const res = await spinRoulette(excludeWinners, effectiveCount);
      if (res.error) setError(res.error);
      else res.spins?.forEach(enqueue);
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

  // Wheel slices: the last spin's layout (so the winner stays under the
  // pointer), plus anyone who joined since. Before any spin, everyone.
  const liveIds = new Set(participants.map((p) => p.id));
  const wheelIds = wheel.ids
    ? [
        ...wheel.ids.filter((id) => liveIds.has(id)),
        ...participants.filter((p) => !wheel.known.includes(p.id)).map((p) => p.id),
      ]
    : participants.map((p) => p.id);
  const wheelSegments: WheelSegment[] = wheelIds.map((id) => {
    const won = !spinning && drawWinners.some((w) => w.winner_id === id);
    return {
      id,
      name: byId.get(id)?.name ?? "",
      won,
      dimmed: dimWinners && wonSet.has(id) && !won,
    };
  });

  // The reel in the hero: the name under the highlight plus its neighbours
  // in the current jumbled order, shown faded above and below.
  const reelIds = order ?? participants.map((p) => p.id);
  const reelIndex = highlight ? reelIds.indexOf(highlight) : -1;
  const reelAt = (offset: number) =>
    reelIndex < 0
      ? undefined
      : byId.get(
          reelIds[(reelIndex + offset + reelIds.length) % reelIds.length],
        );
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
            {drawTotal > 1 && (spinning || winner)
              ? spinning
                ? `Winner ${drawWinners.length + 1} of ${drawTotal}`
                : busy
                  ? `Winner ${drawWinners.length} of ${drawTotal}`
                  : `${drawTotal} winners`
              : spinning
                ? "Jumbling"
                : winner
                  ? "Winner"
                  : "Live draw"}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-white/80">
              {dimWinners
                ? `${eligibleCount} of ${participants.length} haven't won`
                : `${participants.length} ${participants.length === 1 ? "name" : "names"}`}
            </span>
            <div
              className="glass-pill flex rounded-full p-0.5 text-xs"
              role="radiogroup"
              aria-label="View"
            >
              {(["reel", "wheel"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-3 py-1 capitalize transition ${
                    view === v ? "bg-white/25 text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className={
            view === "wheel"
              ? "flex flex-1 flex-col-reverse gap-8 md:flex-row md:items-center"
              : "flex flex-1 flex-col"
          }
        >
        <div className="flex flex-1 flex-col justify-between gap-10">

        {view === "reel" && spinning && reelCurrent ? (
          <div className="reel flex flex-col gap-2" aria-hidden>
            <p className="reel-ghost truncate text-2xl font-light sm:text-3xl">
              {reelAt(-1)?.name}
            </p>
            <div key={tickCount} className="reel-in">
              <p className="text-lift truncate text-5xl font-light leading-[1.1] tracking-tight sm:text-7xl">
                {reelCurrent.name}
              </p>
            </div>
            <p className="reel-ghost truncate text-2xl font-light sm:text-3xl">
              {reelAt(1)?.name}
            </p>
          </div>
        ) : winner ? (
          <div
            key={winner.id}
            className="winner-pop flex flex-col gap-5"
          >
            <div className="burst" aria-hidden>
              {Array.from({ length: 28 }, (_, i) => (
                <span key={i} style={{ "--i": i } as React.CSSProperties} />
              ))}
            </div>
            <p className="winner-name text-lift text-5xl font-normal leading-[1.05] tracking-tight sm:text-7xl">
              {winner.winner_name}
            </p>
          </div>
        ) : (
          <p className="text-lift max-w-xl text-4xl font-light leading-[1.1] tracking-tight sm:text-5xl">
            {spinning
              ? view === "wheel"
                ? "Spinning the wheel…"
                : "Jumbling the names…"
              : participants.length === 0
                ? "No names yet. Sign in to add yours."
                : "Who will the roulette pick next?"}
          </p>
        )}

        {drawTotal > 1 && drawWinners.length > 0 && (
          <ol className="flex flex-wrap gap-2" aria-label="Winners this draw">
            {drawWinners.map((w, i) => (
              <li
                key={w.id}
                className="glass-pill rounded-full !border-teal-200/50 px-3 py-1 text-sm"
              >
                <span className="text-teal-100/70">{i + 1}.</span> {w.winner_name}
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-wrap items-center gap-4">
          {mode === "admin" ? (
            <>
              <button
                onClick={spin}
                disabled={
                  busy ||
                  pending ||
                  (excludeWinners ? eligibleCount : participants.length) === 0
                }
                className="glass-pill rounded-full !border-white/70 !bg-white/30 px-8 py-2.5 font-medium text-white !shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_0_40px_rgb(45_212_191/0.4)] transition hover:!bg-white/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Spinning…" : "Spin"}
              </button>
              <div className="flex items-center gap-2 text-sm text-white/85">
                <span id="winner-count-label">Winners</span>
                <div
                  className="glass-pill flex items-center rounded-full"
                  role="group"
                  aria-labelledby="winner-count-label"
                >
                  <button
                    type="button"
                    onClick={() => setWinnerCount(Math.max(1, effectiveCount - 1))}
                    disabled={busy || effectiveCount <= 1}
                    aria-label="Fewer winners"
                    className="h-8 w-8 rounded-full transition hover:bg-white/10 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-6 text-center tabular-nums" aria-live="polite">
                    {effectiveCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWinnerCount(Math.min(maxWinners, effectiveCount + 1))}
                    disabled={busy || effectiveCount >= maxWinners}
                    aria-label="More winners"
                    className="h-8 w-8 rounded-full transition hover:bg-white/10 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-3 text-sm text-white/85">
                <input
                  type="checkbox"
                  role="switch"
                  checked={excludeWinners}
                  onChange={(e) => {
                    setExcludeWinners(e.target.checked);
                    setWheel((w) => ({ ...w, ids: null }));
                  }}
                  disabled={busy}
                  className="peer sr-only"
                />
                <span className="glass-pill relative h-6 w-11 shrink-0 rounded-full transition peer-checked:!bg-teal-400/50 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-300/60 after:absolute after:left-0.5 after:top-0.5 after:h-[1.125rem] after:w-[1.125rem] after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
                Only players who haven&apos;t won
              </label>
              {excludeWinners && eligibleCount === 0 && participants.length > 0 && (
                <span className="text-sm text-rose-200">Everyone has already won.</span>
              )}
            </>
          ) : userId && !viewerIsAdmin ? (
            <>
              <button
                onClick={toggleMembership}
                disabled={busy || pending}
                className="glass-pill rounded-full px-5 py-2.5 text-sm transition hover:brightness-125 disabled:opacity-40"
              >
                {isRegistered ? "Remove my name" : "Add my name"}
              </button>
              <span className="text-sm text-white/70">
                The host will spin when it&apos;s time.
              </span>
            </>
          ) : userId ? (
            <span className="text-sm text-white/80">
              Spin from the admin page.
            </span>
          ) : (
            <span className="text-sm text-white/80">
              Sign in with Google to join the draw
            </span>
          )}
          <span
            className={`ml-auto hidden h-px w-40 bg-white/50 ${view === "reel" ? "sm:block" : ""}`}
            aria-hidden
          />
        </div>
        </div>

        {view === "wheel" && (
          <Wheel
            segments={wheelSegments}
            rotation={wheel.rotation}
            durationMs={wheel.duration}
            spinning={spinning}
          />
        )}
        </div>
      </section>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        {(mode === "admin" || displayed.length > 0) && (
          <div className="flex flex-col gap-4">
            {mode === "admin" && <AddNamesForm disabled={busy} />}
            <ul className="grid grid-cols-2 content-start gap-3 sm:grid-cols-3">
          {displayed.map((p) => {
            const active = highlight === p.id;
            const isWinner =
              !(spinning && active) &&
              drawWinners.some((w) => w.winner_id === p.id);
            const hasWon = wonSet.has(p.id);
            const dimmed = dimWinners && hasWon && !isWinner;
            return (
              <li
                key={p.id}
                className={`glass relative flex items-center justify-center gap-2 rounded-2xl py-2.5 text-center transition-all duration-150 ${
                  mode === "admin" ? "px-7" : "px-3"
                } ${
                  isWinner
                    ? "scale-105 !border-teal-200/70 !bg-teal-400/25 !shadow-[0_0_40px_rgb(45_212_191/0.45)]"
                    : active
                      ? "scale-105 !border-indigo-300/60 !bg-indigo-500/25 !shadow-[0_0_24px_rgb(99_102_241/0.4)]"
                      : ""
                } ${dimmed ? "opacity-40" : ""}`}
              >
                <span className="truncate text-sm">
                  {p.name}
                  {p.id === userId && (
                    <span className="text-white/50"> (you)</span>
                  )}
                </span>
                {hasWon && (
                  <span className="shrink-0 rounded-full border border-teal-200/40 px-1.5 text-[10px] uppercase tracking-wider text-teal-100/90">
                    Won
                  </span>
                )}
                {mode === "admin" && (
                  <button
                    onClick={() => remove(p)}
                    disabled={busy || pending}
                    aria-label={`Remove ${p.name}`}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full px-1.5 text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
            </ul>
          </div>
        )}

        <aside className="glass self-start rounded-3xl p-5 lg:col-start-2 lg:row-start-1">
          <h2 className="mb-4 text-sm text-white/60">Recent winners</h2>
          {history.length === 0 ? (
            <p className="text-sm text-white/50">No spins yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {history.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="truncate">{s.winner_name}</span>
                  <time className="ml-auto shrink-0 text-xs text-white/50">
                    {new Date(s.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
