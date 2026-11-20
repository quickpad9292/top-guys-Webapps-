"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Archive,
  Check,
  Folder as FolderIcon,
  Hash,
  LogOut,
  Monitor,
  Moon,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Pin,
  Plus,
  Search,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, paletteOf, PALETTE_COLORS, PALETTE } from "@/lib/utils";
import { Kbd, Logo } from "@/components/ui";
import { useStore, type View } from "./store";

function sameView(a: View, b: View) {
  return a.kind === b.kind && ("id" in a ? a.id : null) === ("id" in b ? b.id : null);
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={cn(
          "focus-ring flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm transition",
          active
            ? "bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 font-semibold text-fg shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]"
            : "text-fg/75 hover:bg-fg/[0.05] hover:text-fg",
        )}
      >
        <span className="grid w-4 shrink-0 place-items-center">{icon}</span>
        <span className="truncate">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="ml-auto text-xs tabular-nums text-muted group-hover:opacity-0">{count}</span>
        )}
      </button>
      {children}
    </div>
  );
}

function ColorDots({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          className={cn("grid h-5 w-5 place-items-center rounded-full", PALETTE[c].dot)}
          aria-label={c}
        >
          {value === c && <Check className="h-3 w-3 text-white" />}
        </button>
      ))}
    </div>
  );
}

function InlineAdd({ placeholder, onSubmit, onCancel }: { placeholder: string; onSubmit: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onSubmit(v.trim());
      }}
      className="flex items-center gap-1 px-1 py-1"
    >
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        onBlur={() => !v.trim() && onCancel()}
        placeholder={placeholder}
        maxLength={60}
        className="h-8 w-full rounded-lg border border-accent/40 bg-solid px-2 text-sm outline-none focus:ring-4 focus:ring-accent/15"
      />
      <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted hover:text-fg" aria-label="Cancel">
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

function ItemMenu({
  color,
  onRename,
  onColor,
  onDelete,
}: {
  color: string;
  onRename?: () => void;
  onColor: (c: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-muted opacity-0 transition group-hover:opacity-100 hover:bg-fg/10 hover:text-fg focus:opacity-100"
        aria-label="Options"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="glass absolute top-9 right-0 z-50 w-52 space-y-1 rounded-2xl !bg-solid p-2">
            <div className="px-1.5 pt-1 pb-2">
              <ColorDots
                value={color}
                onPick={(c) => {
                  onColor(c);
                  setOpen(false);
                }}
              />
            </div>
            {onRename && (
              <button
                onClick={() => {
                  setOpen(false);
                  onRename();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-fg/[0.06]"
              >
                <Pencil className="h-3.5 w-3.5" /> Rename
              </button>
            )}
            <button
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </>
  );
}

export function Sidebar() {
  const router = useRouter();
  const {
    user,
    notes,
    folders,
    tags,
    view,
    setView,
    createNote,
    createFolder,
    updateFolder,
    deleteFolder,
    createTag,
    updateTag,
    deleteTag,
    setPaletteOpen,
  } = useStore();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const { theme, setTheme } = useTheme();
  const [adding, setAdding] = useState<"folder" | "tag" | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const go = (v: View) => {
    setView(v);
    router.push("/notes");
  };

  const active = notes.filter((n) => !n.is_archived);
  const counts = {
    all: active.length,
    pinned: active.filter((n) => n.is_pinned).length,
    shared: notes.filter((n) => n.shared).length,
    archived: notes.filter((n) => n.is_archived).length,
  };

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const ThemeIcon = !mounted ? Monitor : theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <div className="glass flex h-full flex-col !rounded-none !border-y-0 !border-l-0 lg:!bg-elev/40">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <Logo className="h-8 w-8" />
        <span className="font-display text-lg font-bold tracking-tight">Cognithan</span>
      </div>

      <div className="space-y-2 px-3">
        <button
          onClick={() => createNote()}
          className="bg-gradient-brand focus-ring flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> New note
        </button>
        <button
          onClick={() => setPaletteOpen(true)}
          className="focus-ring flex h-9 w-full items-center gap-2 rounded-xl border border-line bg-solid/50 px-3 text-sm text-muted transition hover:border-line-strong hover:text-fg"
        >
          <Search className="h-4 w-4" />
          Search & commands
          <span className="ml-auto flex gap-0.5">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>

      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">
          <NavItem icon={<NotebookPen className="h-4 w-4" />} label="All notes" count={counts.all} active={sameView(view, { kind: "all" })} onClick={() => go({ kind: "all" })} />
          <NavItem icon={<Pin className="h-4 w-4" />} label="Pinned" count={counts.pinned} active={view.kind === "pinned"} onClick={() => go({ kind: "pinned" })} />
          <NavItem icon={<Users className="h-4 w-4" />} label="Shared with me" count={counts.shared} active={view.kind === "shared"} onClick={() => go({ kind: "shared" })} />
          <NavItem icon={<Archive className="h-4 w-4" />} label="Archive" count={counts.archived} active={view.kind === "archived"} onClick={() => go({ kind: "archived" })} />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between px-2.5">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Folders</span>
            <button onClick={() => setAdding("folder")} className="rounded-md p-0.5 text-muted hover:bg-fg/10 hover:text-fg" aria-label="New folder">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {folders.map((f) =>
              renaming === f.id ? (
                <InlineAdd
                  key={f.id}
                  placeholder={f.name}
                  onSubmit={(name) => {
                    updateFolder(f.id, { name });
                    setRenaming(null);
                  }}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                <NavItem
                  key={f.id}
                  icon={<FolderIcon className={cn("h-4 w-4", paletteOf(f.color).soft.split(" ").slice(1).join(" "))} />}
                  label={f.name}
                  count={active.filter((n) => n.folder_id === f.id).length}
                  active={view.kind === "folder" && view.id === f.id}
                  onClick={() => go({ kind: "folder", id: f.id })}
                >
                  <ItemMenu
                    color={f.color}
                    onColor={(color) => updateFolder(f.id, { color })}
                    onRename={() => setRenaming(f.id)}
                    onDelete={() => {
                      if (confirm(`Delete folder "${f.name}"? Notes inside are kept.`)) deleteFolder(f.id);
                    }}
                  />
                </NavItem>
              ),
            )}
            {adding === "folder" && (
              <InlineAdd
                placeholder="Folder name"
                onSubmit={async (name) => {
                  const colors = PALETTE_COLORS;
                  await createFolder(name, colors[folders.length % colors.length]);
                  setAdding(null);
                }}
                onCancel={() => setAdding(null)}
              />
            )}
            {folders.length === 0 && adding !== "folder" && (
              <p className="px-2.5 py-1 text-xs text-muted">No folders yet</p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between px-2.5">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Tags</span>
            <button onClick={() => setAdding("tag")} className="rounded-md p-0.5 text-muted hover:bg-fg/10 hover:text-fg" aria-label="New tag">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {tags.map((t) => (
              <NavItem
                key={t.id}
                icon={<span className={cn("h-2.5 w-2.5 rounded-full", paletteOf(t.color).dot)} />}
                label={t.name}
                count={active.filter((n) => n.tag_ids.includes(t.id)).length}
                active={view.kind === "tag" && view.id === t.id}
                onClick={() => go({ kind: "tag", id: t.id })}
              >
                <ItemMenu
                  color={t.color}
                  onColor={(color) => updateTag(t.id, { color })}
                  onDelete={() => {
                    if (confirm(`Delete tag "#${t.name}"?`)) deleteTag(t.id);
                  }}
                />
              </NavItem>
            ))}
            {adding === "tag" && (
              <InlineAdd
                placeholder="Tag name"
                onSubmit={async (name) => {
                  await createTag(name, PALETTE_COLORS[(tags.length + 1) % PALETTE_COLORS.length]);
                  setAdding(null);
                }}
                onCancel={() => setAdding(null)}
              />
            )}
            {tags.length === 0 && adding !== "tag" && (
              <p className="flex items-center gap-1 px-2.5 py-1 text-xs text-muted">
                <Hash className="h-3 w-3" /> No tags yet
              </p>
            )}
          </div>
        </div>
      </nav>

      <div className="flex items-center gap-2 border-t border-line p-3">
        <div className="bg-gradient-brand grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white uppercase">
          {user.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <button
          onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}
          className="rounded-lg p-2 text-muted hover:bg-fg/[0.06] hover:text-fg"
          aria-label="Toggle theme"
          title={`Theme: ${theme ?? "system"}`}
        >
          <ThemeIcon className="h-4 w-4" />
        </button>
        <button onClick={signOut} className="rounded-lg p-2 text-muted hover:bg-fg/[0.06] hover:text-fg" aria-label="Sign out" title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
