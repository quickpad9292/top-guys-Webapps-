"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Archive, FileText, Folder, Hash, LogOut, Moon, NotebookPen, Pin, Plus, Sun, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { paletteOf, cn } from "@/lib/utils";
import { Kbd } from "@/components/ui";
import { useStore } from "./store";

export function CommandPalette() {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const { paletteOpen, setPaletteOpen, notes, folders, tags, createNote, setView } = useStore();

  const run = (fn: () => void) => {
    setPaletteOpen(false);
    fn();
  };

  if (!paletteOpen) return null;

  const item =
    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg/85 data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-violet-500/15 data-[selected=true]:to-fuchsia-500/10 data-[selected=true]:text-fg";
  const group =
    "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase";

  return (
    <div
      className="no-print fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && setPaletteOpen(false)}
    >
      <Command
        label="Command palette"
        className="glass w-full max-w-xl overflow-hidden rounded-3xl !bg-solid/95"
        onKeyDown={(e) => e.key === "Escape" && setPaletteOpen(false)}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <span className="bg-gradient-brand h-2.5 w-2.5 rounded-full" />
          <Command.Input
            autoFocus
            placeholder="Search notes or type a command…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70"
          />
          <Kbd>esc</Kbd>
        </div>
        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          <Command.Empty className="py-10 text-center text-sm text-muted">No results.</Command.Empty>

          <Command.Group heading="Actions" className={group}>
            <Command.Item className={item} onSelect={() => run(() => createNote())}>
              <Plus className="h-4 w-4 text-accent" /> New note
              <span className="ml-auto flex gap-0.5"><Kbd>⌘</Kbd><Kbd>⌥</Kbd><Kbd>N</Kbd></span>
            </Command.Item>
            <Command.Item className={item} onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              Toggle {resolvedTheme === "dark" ? "light" : "dark"} mode
            </Command.Item>
            {[
              { label: "All notes", icon: NotebookPen, v: { kind: "all" as const } },
              { label: "Pinned", icon: Pin, v: { kind: "pinned" as const } },
              { label: "Shared with me", icon: Users, v: { kind: "shared" as const } },
              { label: "Archive", icon: Archive, v: { kind: "archived" as const } },
            ].map(({ label, icon: Icon, v }) => (
              <Command.Item key={label} value={`go ${label}`} className={item} onSelect={() => run(() => { setView(v); router.push("/notes"); })}>
                <Icon className="h-4 w-4" /> Go to {label}
              </Command.Item>
            ))}
            <Command.Item
              className={item}
              onSelect={() =>
                run(async () => {
                  await createClient().auth.signOut();
                  router.replace("/login");
                })
              }
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Command.Item>
          </Command.Group>

          {folders.length > 0 && (
            <Command.Group heading="Folders" className={group}>
              {folders.map((f) => (
                <Command.Item key={f.id} value={`folder ${f.name} ${f.id}`} className={item} onSelect={() => run(() => { setView({ kind: "folder", id: f.id }); router.push("/notes"); })}>
                  <Folder className={cn("h-4 w-4", paletteOf(f.color).soft.split(" ").slice(1).join(" "))} /> {f.name}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {tags.length > 0 && (
            <Command.Group heading="Tags" className={group}>
              {tags.map((t) => (
                <Command.Item key={t.id} value={`tag ${t.name} ${t.id}`} className={item} onSelect={() => run(() => { setView({ kind: "tag", id: t.id }); router.push("/notes"); })}>
                  <Hash className="h-4 w-4" /> {t.name}
                  <span className={cn("ml-auto h-2.5 w-2.5 rounded-full", paletteOf(t.color).dot)} />
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group heading="Notes" className={group}>
            {notes.slice(0, 200).map((n) => (
              <Command.Item
                key={n.id}
                value={`${n.title || "Untitled"} ${n.preview} ${n.id}`}
                className={item}
                onSelect={() => run(() => router.push(`/notes/${n.id}`))}
              >
                {n.emoji ? <span className="w-4 text-center">{n.emoji}</span> : <FileText className="h-4 w-4 text-muted" />}
                <span className="truncate">{n.title || "Untitled"}</span>
                {n.is_archived && <Archive className="ml-auto h-3.5 w-3.5 text-muted" />}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
