import { RouletteDemo } from "./RouletteDemo";

const participants = [
  { id: "p0", name: "Maria Santos", email: null, avatar_url: null, created_at: "2026-01-01" },
  { id: "p1", name: "John Reyes", email: null, avatar_url: null, created_at: "2026-01-01" },
  { id: "p2", name: "Aiko Tanaka", email: null, avatar_url: null, created_at: "2026-01-01" },
  { id: "p3", name: "Carlos Mendoza", email: null, avatar_url: null, created_at: "2026-01-01" },
  { id: "p4", name: "Priya Sharma", email: null, avatar_url: null, created_at: "2026-01-01" },
  { id: "p5", name: "Liam O'Brien", email: null, avatar_url: null, created_at: "2026-01-01" },
  { id: "p6", name: "Sofia Rossi", email: null, avatar_url: null, created_at: "2026-01-01" },
  { id: "p7", name: "Noah Kim", email: null, avatar_url: null, created_at: "2026-01-01" },
  { id: "p8", name: "Emma Dubois", email: null, avatar_url: null, created_at: "2026-01-01" },
  { id: "p9", name: "Mateo Garcia", email: null, avatar_url: null, created_at: "2026-01-01" },
];

export default function Preview() {
  return (
    <><style>{`.burst span{animation-delay:-0.35s!important;animation-play-state:paused!important}`}</style><main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <RouletteDemo participants={participants} recentSpins={[]} userId={null} mode="admin" />
    </main></>
  );
}
