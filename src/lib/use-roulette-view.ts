"use client";

import { useSyncExternalStore } from "react";

export type RouletteView = "reel" | "wheel";

// A choice each viewer makes for themselves, remembered in their browser only.
function storedPreference<T extends string>(
  key: string,
  values: readonly T[],
  initial: T,
) {
  const event = `${key}-change`;
  let fallback = initial; // used when storage is unavailable

  function read(): T {
    try {
      const stored = localStorage.getItem(key);
      if (values.includes(stored as T)) return stored as T;
    } catch {}
    return fallback;
  }

  function subscribe(onChange: () => void) {
    window.addEventListener("storage", onChange);
    window.addEventListener(event, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(event, onChange);
    };
  }

  return function usePreference() {
    const value = useSyncExternalStore(subscribe, read, () => initial);
    const setValue = (next: T) => {
      fallback = next;
      try {
        localStorage.setItem(key, next);
      } catch {}
      window.dispatchEvent(new Event(event));
    };
    return [value, setValue] as const;
  };
}

export const useRouletteView = storedPreference<RouletteView>(
  "roulette-view",
  ["reel", "wheel"],
  "reel",
);

// Whether a draw takes over the whole screen while it plays.
export const useFocusMode = storedPreference(
  "roulette-focus",
  ["on", "off"],
  "off",
);
