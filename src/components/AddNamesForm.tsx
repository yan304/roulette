"use client";

import { useRef, useState, useTransition } from "react";
import { addParticipants } from "@/app/actions";

// Admin-only: type names in by hand for people who won't sign in with Google.
export function AddNamesForm({ disabled }: { disabled: boolean }) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!value.trim()) return;
    startTransition(async () => {
      const res = await addParticipants(value);
      if (res.error) {
        setMessage({ error: true, text: res.error });
      } else {
        setMessage({ error: false, text: `Added ${res.added} ${res.added === 1 ? "name" : "names"}.` });
        setValue("");
        inputRef.current?.focus();
      }
    });
  }

  return (
    <form onSubmit={submit} className="glass flex flex-col gap-3 rounded-3xl p-4">
      <label htmlFor="add-names" className="text-sm text-white/70">
        Add names manually
      </label>
      <div className="flex items-start gap-3">
        <textarea
          id="add-names"
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds; Shift+Enter starts a new line for pasting lists.
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          rows={1}
          placeholder="Juan Dela Cruz"
          className="glass-pill field-sizing-content max-h-40 min-h-11 flex-1 resize-none rounded-2xl !bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-teal-300/50"
        />
        <button
          disabled={disabled || pending || !value.trim()}
          className="glass-pill h-11 shrink-0 rounded-full px-5 text-sm font-medium transition hover:brightness-125 disabled:opacity-40"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <p className={`text-xs ${message?.error ? "text-rose-300" : "text-white/50"}`}>
        {message?.text ?? "Put each name on its own line (Shift+Enter)."}
      </p>
    </form>
  );
}
