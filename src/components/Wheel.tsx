export type WheelSegment = {
  id: string;
  name: string;
  // Past winner while "only players who haven't won" is on.
  dimmed: boolean;
  // Winner of the current draw.
  won: boolean;
};

type Props = {
  segments: WheelSegment[];
  // Total rotation in degrees; it only ever increases so each spin turns forward.
  rotation: number;
  // How long the current spin takes to slow to a stop.
  durationMs: number;
  spinning: boolean;
  // Fill most of the screen (focus mode).
  large?: boolean;
};

const FILLS = [
  "rgb(99 102 241 / 0.45)", // indigo
  "rgb(45 212 191 / 0.32)", // teal
  "rgb(30 58 138 / 0.55)", // navy
];

// Point on the circle, with 0° at the top and angles going clockwise.
function point(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return `${(Math.sin(rad) * r).toFixed(3)} ${(-Math.cos(rad) * r).toFixed(3)}`;
}

function fontSize(count: number) {
  if (count <= 8) return 9;
  if (count <= 16) return 7;
  if (count <= 30) return 5;
  return 4;
}

// A roulette wheel of glass slices, one per name, with a fixed pointer on top.
export function Wheel({
  segments,
  rotation,
  durationMs,
  spinning,
  large = false,
}: Props) {
  const n = segments.length;
  const size = 360 / Math.max(n, 1);
  const text = fontSize(n);
  // Avoid two neighbours sharing a colour where the wheel wraps around.
  const fillFor = (i: number) =>
    FILLS[n % 3 === 1 && i === n - 1 ? 1 : i % 3];

  return (
    <div
      className={`relative mx-auto aspect-square shrink-0 ${
        large ? "w-[min(85vw,70vh)]" : "w-[min(78vw,340px)]"
      }`}
    >
      <svg viewBox="-112 -112 224 224" className="h-full w-full overflow-visible" role="img" aria-label="Roulette wheel">
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformBox: "view-box",
            transformOrigin: "0 0",
            transition: spinning
              ? `transform ${durationMs}ms cubic-bezier(0.12, 0.7, 0.1, 1)`
              : "none",
          }}
          className="wheel-spin"
        >
          {n === 0 && (
            <circle r="100" fill="rgb(255 255 255 / 0.06)" />
          )}
          {n === 1 && (
            <circle r="100" fill={segments[0].won ? "rgb(45 212 191 / 0.75)" : FILLS[0]} />
          )}
          {n > 1 &&
            segments.map((s, i) => {
              const a0 = i * size;
              const a1 = a0 + size;
              return (
                <path
                  key={s.id}
                  d={`M 0 0 L ${point(a0, 100)} A 100 100 0 ${size > 180 ? 1 : 0} 1 ${point(a1, 100)} Z`}
                  fill={s.won ? "rgb(45 212 191 / 0.75)" : fillFor(i)}
                  stroke="rgb(255 255 255 / 0.28)"
                  strokeWidth="0.6"
                  opacity={s.dimmed ? 0.35 : 1}
                />
              );
            })}
          {segments.map((s, i) => {
            const mid = i * size + size / 2;
            const label = s.name.length > 16 ? `${s.name.slice(0, 15)}…` : s.name;
            return (
              <text
                key={s.id}
                transform={`rotate(${mid - 90})`}
                x="92"
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={text}
                fill="white"
                opacity={s.dimmed ? 0.4 : 1}
                style={{ fontWeight: s.won ? 600 : 400 }}
              >
                {label}
              </text>
            );
          })}
        </g>

        {/* Rim and hub stay still; the glass edge catches light top-left. */}
        <circle r="100" fill="none" stroke="url(#wheel-rim)" strokeWidth="2" />
        <circle r="15" fill="rgb(255 255 255 / 0.18)" stroke="rgb(255 255 255 / 0.55)" strokeWidth="1" />
        <circle r="5" fill="white" opacity="0.9" />

        {/* Pointer */}
        <path
          d="M -8 -110 L 8 -110 L 0 -92 Z"
          fill="white"
          stroke="rgb(45 212 191)"
          strokeWidth="1"
          style={{ filter: "drop-shadow(0 0 6px rgb(45 212 191))" }}
        />

        <defs>
          <linearGradient id="wheel-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.75" />
            <stop offset="0.5" stopColor="white" stopOpacity="0.15" />
            <stop offset="1" stopColor="white" stopOpacity="0.45" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
