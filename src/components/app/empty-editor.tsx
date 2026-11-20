"use client";

import { Plus } from "lucide-react";
import { Button, Kbd } from "@/components/ui";
import { useStore } from "./store";

export function EmptyEditor() {
  const { createNote, setPaletteOpen } = useStore();
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-sm text-center">
        <div className="relative mx-auto mb-6 h-28 w-28">
          <div className="bg-gradient-brand absolute inset-0 rotate-6 rounded-[2rem] opacity-30 blur-xl" />
          <div className="bg-gradient-brand relative grid h-full w-full -rotate-3 place-items-center rounded-[2rem] text-5xl shadow-2xl shadow-fuchsia-500/30">
            ✍️
          </div>
        </div>
        <h2 className="font-display text-3xl font-bold tracking-tight">Pick a note, or start fresh</h2>
        <p className="mt-2 text-muted">Your ideas deserve a blank canvas.</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button size="lg" onClick={() => createNote()}>
            <Plus className="h-4 w-4" /> New note
          </Button>
          <button onClick={() => setPaletteOpen(true)} className="flex items-center gap-1.5 text-sm text-muted hover:text-fg">
            or press <Kbd>⌘</Kbd> <Kbd>K</Kbd> to search
          </button>
        </div>
      </div>
    </div>
  );
}
