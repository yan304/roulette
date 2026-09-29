"use client";

import { useSyncExternalStore } from "react";

export type RouletteView = "reel" | "wheel";

// Each viewer picks their own view; it's remembered in their browser only.
const KEY = "roulette-view";
const EVENT = "roulette-view-change";
let fallback: RouletteView = "reel"; // used when storage is unavailable

function read(): RouletteView {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "reel" || stored === "wheel") return stored;
  } catch {}
  return fallback;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useRouletteView() {
  const view = useSyncExternalStore(subscribe, read, () => "reel" as const);
  const setView = (next: RouletteView) => {
    fallback = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  };
  return [view, setView] as const;
}
