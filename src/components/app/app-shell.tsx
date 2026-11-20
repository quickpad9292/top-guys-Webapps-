"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { NotesProvider, useStore, type SessionUser } from "./store";
import { Sidebar } from "./sidebar";
import { NoteList } from "./note-list";
import { CommandPalette } from "./command-palette";

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inNote = pathname !== "/notes";
  const { sidebarOpen, setSidebarOpen, setPaletteOpen, createNote } = useStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (mod && e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        createNote();
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen, createNote, setSidebarOpen, sidebarOpen]);

  // Close the mobile drawer on navigation.
  useEffect(() => {
     
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  return (
    <div className="relative flex h-dvh overflow-hidden">
      <div aria-hidden className="no-print pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-48 left-1/4 h-[30rem] w-[30rem] rounded-full bg-violet-500/15 blur-[130px]" />
        <div className="absolute -right-32 bottom-0 h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/10 blur-[130px]" />
      </div>

      {/* Sidebar: drawer on mobile, column on desktop */}
      <div
        className={cn(
          "no-print fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 w-[272px] transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar />
      </aside>

      <section
        className={cn(
          "no-print w-full shrink-0 border-r border-line md:w-[340px]",
          inNote ? "hidden md:block" : "block",
        )}
      >
        <NoteList />
      </section>

      <main className={cn("print-area min-w-0 flex-1", inNote ? "block" : "hidden md:block")}>
        {children}
      </main>

      <CommandPalette />
    </div>
  );
}

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <NotesProvider user={user}>
      <Shell>{children}</Shell>
    </NotesProvider>
  );
}
