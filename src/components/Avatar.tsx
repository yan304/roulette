import Image from "next/image";

export function Avatar({ name, src, size = 32 }: { name: string; src: string | null; size?: number }) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full border border-white/25 bg-indigo-500/25 text-xs font-medium uppercase text-white backdrop-blur"
    >
      {name.slice(0, 1)}
    </span>
  );
}
