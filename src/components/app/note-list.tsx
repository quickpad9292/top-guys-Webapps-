"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Archive, FileText, Globe, Loader2, Menu, Pin, Plus, Search, Users, X } from "lucide-react";
import { cn, paletteOf, timeAgo } from "@/lib/utils";
import { useStore } from "./store";

export function NoteList() {
  const pathname = usePathname();
  const { visibleNotes, view, folders, tags, query, setQuery, searching, loading, createNote, setSidebarOpen } =
    useStore();

  const title =
    view.kind === "all"
      ? "All notes"
      : view.kind === "pinned"
        ? "Pinned"
        : view.kind === "shared"
          ? "Shared with me"
          : view.kind === "archived"
            ? "Archive"
            : view.kind === "folder"
              ? (folders.find((f) => f.id === view.id)?.name ?? "Folder")
              : `#${tags.find((t) => t.id === view.id)?.name ?? "tag"}`;

  return (
    <div className="flex h-full flex-col bg-solid/30">
      <div className="space-y-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-1 rounded-lg p-1.5 text-muted hover:bg-fg/[0.06] hover:text-fg lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="truncate font-display text-2xl font-bold tracking-tight">{title}</h1>
          <span className="mt-1 rounded-full bg-fg/[0.06] px-2 py-0.5 text-xs font-medium tabular-nums text-muted">
            {visibleNotes.length}
          </span>
          <button
            onClick={() => createNote()}
            className="bg-gradient-brand ml-auto grid h-8 w-8 place-items-center rounded-lg text-white shadow-md shadow-fuchsia-500/25 transition hover:brightness-110 active:scale-95"
            aria-label="New note"
            title="New note (⌘⌥N)"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="h-10 w-full rounded-xl border border-line bg-solid/70 pr-9 pl-9 text-sm transition placeholder:text-muted/70 focus:border-accent/50 focus:ring-4 focus:ring-accent/15 focus:outline-none"
          />
          {searching ? (
            <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
          ) : (
            query && (
              <button onClick={() => setQuery("")} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted hover:text-fg" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 pb-6">
        {loading ? (
          <div className="space-y-2 px-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-fg/[0.05]" />
            ))}
          </div>
        ) : visibleNotes.length === 0 ? (
          <div className="mt-16 px-6 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-orange-400/20">
              {view.kind === "archived" ? <Archive className="h-6 w-6 text-accent" /> : <FileText className="h-6 w-6 text-accent" />}
            </div>
            <p className="font-display font-semibold">{query ? "No matches" : "Nothing here yet"}</p>
            <p className="mt-1 text-sm text-muted">
              {query ? "Try a different search." : view.kind === "archived" ? "Archived notes show up here." : "Create a note to get going."}
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {visibleNotes.map((n) => {
                const active = pathname === `/notes/${n.id}`;
                return (
                  <motion.li
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Link
                      href={`/notes/${n.id}`}
                      className={cn(
                        "focus-ring group block rounded-2xl border p-3.5 transition-all",
                        active
                          ? "border-accent/40 bg-gradient-to-br from-violet-500/[0.12] via-fuchsia-500/[0.07] to-orange-400/[0.06] shadow-[0_8px_30px_-12px_rgba(139,92,246,0.45)]"
                          : "border-transparent hover:border-line hover:bg-solid/70",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {n.emoji && <span className="text-lg leading-6">{n.emoji}</span>}
                        <h3 className={cn("line-clamp-1 flex-1 font-semibold", !n.title && "text-muted")}>
                          {n.title || "Untitled"}
                        </h3>
                        <span className="mt-0.5 flex shrink-0 items-center gap-1 text-muted">
                          {n.is_pinned && !n.shared && <Pin className="h-3.5 w-3.5 fill-current text-accent" />}
                          {n.shared && <Users className="h-3.5 w-3.5 text-accent-2" />}
                          {n.is_public && <Globe className="h-3.5 w-3.5 text-emerald-500" />}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted">
                        {n.preview || "No content yet"}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 overflow-hidden">
                        <span className="shrink-0 text-[11px] text-muted/80">{timeAgo(n.updated_at)}</span>
                        {n.tag_ids.slice(0, 3).map((id) => {
                          const t = tags.find((x) => x.id === id);
                          if (!t) return null;
                          return (
                            <span key={id} className={cn("truncate rounded-full px-2 py-px text-[11px] font-medium", paletteOf(t.color).soft)}>
                              #{t.name}
                            </span>
                          );
                        })}
                      </div>
                    </Link>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
