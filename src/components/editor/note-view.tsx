"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  CloudOff,
  Download,
  Eye,
  Folder as FolderIcon,
  Hash,
  Loader2,
  LogOut,
  MoreHorizontal,
  Pin,
  Printer,
  Share2,
  SmilePlus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import { createClient } from "@/lib/supabase/client";
import type { Peer } from "@/lib/collab";
import type { Note } from "@/lib/types";
import { cn, paletteOf } from "@/lib/utils";
import { useStore } from "@/components/app/store";
import { NoteEditor, type LiveStatus, type NoteEditorHandle, type SaveState } from "./note-editor";
import { ShareDialog } from "./share-dialog";
import { AiPanel } from "./ai-panel";
import { htmlToMarkdown } from "./markdown";

const EMOJIS = ["📝", "💡", "🚀", "🎯", "📚", "🧠", "✅", "🔥", "🌱", "🎨", "💼", "🗓️", "✈️", "🍳", "💪", "🎵", "🧪", "💬", "❤️", "⭐", "🏡", "💰", "🐛", "🔒"];

function Popover({ open, onClose, children, className }: { open: boolean; onClose: () => void; children: React.ReactNode; className?: string }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={cn("glass absolute top-11 right-0 z-50 rounded-2xl !bg-solid/95 p-2", className)}>{children}</div>
    </>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition",
        danger ? "text-rose-600 hover:bg-rose-500/10 dark:text-rose-400" : "hover:bg-fg/[0.06]",
      )}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

export function NoteView({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();
  const { user, folders, tags, notes, updateNote, deleteNote, patchLocal, toggleNoteTag, createTag } = useStore();
  const [note, setNote] = useState<Note | null>(null);
  const [role, setRole] = useState<"owner" | "editor" | "viewer" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [live, setLive] = useState<LiveStatus>("connecting");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [menu, setMenu] = useState<null | "more" | "tags" | "emoji" | "folder">(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const editorRef = useRef<NoteEditorHandle>(null);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("notes").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setError(error?.message ?? "This note doesn't exist or you no longer have access.");
        return;
      }
      const n = data as Note;
      let r: "owner" | "editor" | "viewer" = "owner";
      if (n.user_id !== user.id) {
        const { data: c } = await supabase.from("note_collaborators").select("role").eq("note_id", id).eq("user_id", user.id).maybeSingle();
        r = (c?.role as "editor" | "viewer") ?? "viewer";
      }
      if (cancelled) return;
      setNote(n);
      setRole(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, supabase, user.id]);

  const summary = notes.find((n) => n.id === id);
  const isOwner = role === "owner";
  const canEdit = role === "owner" || role === "editor";

  const onLocalChange = useCallback(
    (patch: { title?: string; emoji?: string | null; preview?: string; updated_at?: string }) => patchLocal(id, patch),
    [id, patchLocal],
  );

  const exportMarkdown = () => {
    const ed = editorRef.current?.editor;
    if (!ed) return;
    const title = summary?.title || note?.title || "Untitled";
    const md = `# ${title}\n\n${htmlToMarkdown(ed.getHTML())}\n`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^\w\- ]+/g, "").trim() || "note"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMenu(null);
  };

  const exportPdf = async () => {
    setMenu(null);
    await editorRef.current?.flush();
    setTimeout(() => window.print(), 50);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        editorRef.current?.flush().then(() => toast.success("Saved"));
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "p" && isOwner) {
        e.preventDefault();
        if (summary) updateNote(id, { is_pinned: !summary.is_pinned });
      } else if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAiOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, isOwner, summary, updateNote]);

  if (error) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <p className="font-display text-2xl font-bold">Note not found</p>
          <p className="mt-2 text-muted">{error}</p>
          <Link href="/notes" className="mt-4 inline-block text-accent hover:underline">
            Back to notes
          </Link>
        </div>
      </div>
    );
  }

  if (!note || !role) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 pt-24">
        <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-fg/[0.06]" />
        <div className="h-4 w-full animate-pulse rounded bg-fg/[0.05]" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-fg/[0.05]" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-fg/[0.05]" />
      </div>
    );
  }

  const folder = folders.find((f) => f.id === (summary?.folder_id ?? note.folder_id));
  const noteTags = (summary?.tag_ids ?? []).map((t) => tags.find((x) => x.id === t)).filter(Boolean);
  const pinned = summary?.is_pinned ?? note.is_pinned;
  const archived = summary?.is_archived ?? note.is_archived;
  const isPublic = summary?.is_public ?? note.is_public;

  const iconBtn = "grid h-9 w-9 place-items-center rounded-xl text-fg/70 transition hover:bg-fg/[0.07] hover:text-fg";

  return (
    <div className="flex h-full flex-col">
      <header className="no-print sticky top-0 z-30 flex min-w-0 items-center gap-0.5 border-b border-line bg-bg/70 px-3 py-2 backdrop-blur-xl sm:px-5">
        <button onClick={() => router.push("/notes")} className={cn(iconBtn, "md:hidden")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Folder (owner) */}
        <div className="relative">
          <button
            disabled={!isOwner}
            onClick={() => setMenu(menu === "folder" ? null : "folder")}
            className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm text-muted transition enabled:hover:bg-fg/[0.06] enabled:hover:text-fg"
          >
            <FolderIcon className={cn("h-4 w-4", folder && paletteOf(folder.color).soft.split(" ").slice(1).join(" "))} />
            <span className="hidden max-w-[9rem] truncate sm:inline">{folder?.name ?? (isOwner ? "No folder" : "Shared note")}</span>
          </button>
          <Popover open={menu === "folder"} onClose={() => setMenu(null)} className="left-0 right-auto w-56">
            <MenuItem icon={FolderIcon} onClick={() => { updateNote(id, { folder_id: null }); setMenu(null); }}>No folder</MenuItem>
            {folders.map((f) => (
              <MenuItem key={f.id} icon={FolderIcon} onClick={() => { updateNote(id, { folder_id: f.id }); setMenu(null); }}>
                {f.name} {f.id === folder?.id && <Check className="ml-auto h-4 w-4 text-accent" />}
              </MenuItem>
            ))}
            {folders.length === 0 && <p className="px-2.5 py-2 text-xs text-muted">Create folders from the sidebar.</p>}
          </Popover>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1">
          {/* Save + live status */}
          <span className="mr-1 hidden items-center gap-1.5 text-xs text-muted sm:flex">
            {!canEdit ? (
              <><Eye className="h-3.5 w-3.5" /> View only</>
            ) : saveState === "saving" ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving</>
            ) : saveState === "error" ? (
              <span className="text-rose-500">Save failed</span>
            ) : saveState === "unsaved" ? (
              <>Editing…</>
            ) : (
              <><Check className="h-3.5 w-3.5 text-emerald-500" /> Saved</>
            )}
            {live === "offline" && <CloudOff className="ml-1 h-3.5 w-3.5" aria-label="Live sync offline" />}
          </span>

          {/* Presence */}
          {peers.length > 0 && (
            <div className="mr-1 flex -space-x-2" aria-label="People viewing">
              {peers.slice(0, 4).map((p) => (
                <span
                  key={p.user_id}
                  title={`${p.name} is here`}
                  className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-white uppercase ring-2 ring-[var(--bg)]"
                  style={{ background: p.color }}
                >
                  {p.name.slice(0, 1)}
                </span>
              ))}
              {peers.length > 4 && <span className="grid h-7 w-7 place-items-center rounded-full bg-fg/10 text-[11px] font-semibold ring-2 ring-[var(--bg)]">+{peers.length - 4}</span>}
            </div>
          )}

          {canEdit && (
            <div className="relative">
              <button onClick={() => setMenu(menu === "emoji" ? null : "emoji")} className={iconBtn} aria-label="Set icon" title="Icon">
                <SmilePlus className="h-[18px] w-[18px]" />
              </button>
              <Popover open={menu === "emoji"} onClose={() => setMenu(null)} className="w-64">
                <div className="grid grid-cols-6 gap-1">
                  {EMOJIS.map((e) => (
                    <button key={e} onClick={() => { editorRef.current?.setEmoji(e); setMenu(null); }} className="grid h-9 place-items-center rounded-lg text-xl hover:bg-fg/[0.07]">
                      {e}
                    </button>
                  ))}
                </div>
                <button onClick={() => { editorRef.current?.setEmoji(null); setMenu(null); }} className="mt-1 w-full rounded-lg py-1.5 text-xs text-muted hover:bg-fg/[0.06]">
                  Remove icon
                </button>
              </Popover>
            </div>
          )}

          {isOwner && (
            <>
              <div className="relative">
                <button onClick={() => setMenu(menu === "tags" ? null : "tags")} className={iconBtn} aria-label="Tags" title="Tags">
                  <Hash className="h-[18px] w-[18px]" />
                </button>
                <Popover open={menu === "tags"} onClose={() => setMenu(null)} className="w-64">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const t = await createTag(tagInput);
                      if (t && !summary?.tag_ids.includes(t.id)) await toggleNoteTag(id, t.id);
                      setTagInput("");
                    }}
                  >
                    <input
                      autoFocus
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Add or create tag…"
                      className="mb-1 h-9 w-full rounded-lg border border-line-strong bg-transparent px-2.5 text-sm outline-none focus:border-accent/50"
                    />
                  </form>
                  <div className="max-h-60 overflow-y-auto">
                    {tags
                      .filter((t) => !tagInput || t.name.toLowerCase().includes(tagInput.toLowerCase().replace(/^#/, "")))
                      .map((t) => {
                        const on = summary?.tag_ids.includes(t.id);
                        return (
                          <button key={t.id} onClick={() => toggleNoteTag(id, t.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm hover:bg-fg/[0.06]">
                            <span className={cn("h-2.5 w-2.5 rounded-full", paletteOf(t.color).dot)} />
                            {t.name}
                            {on && <Check className="ml-auto h-4 w-4 text-accent" />}
                          </button>
                        );
                      })}
                  </div>
                </Popover>
              </div>
              <button
                onClick={() => updateNote(id, { is_pinned: !pinned })}
                className={cn(iconBtn, pinned && "text-accent")}
                aria-label={pinned ? "Unpin" : "Pin"}
                title={pinned ? "Unpin (⌘⇧P)" : "Pin (⌘⇧P)"}
              >
                <Pin className={cn("h-[18px] w-[18px]", pinned && "fill-current")} />
              </button>
            </>
          )}

          <button onClick={() => setAiOpen((o) => !o)} className={cn(iconBtn, aiOpen && "text-accent")} aria-label="AI assistant" title="AI assistant (⌘J)">
            <Sparkles className="h-[18px] w-[18px]" />
          </button>

          <button
            onClick={() => setShareOpen(true)}
            className="bg-gradient-brand ml-1 flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/25 transition hover:brightness-110 active:scale-95"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <div className="relative">
            <button onClick={() => setMenu(menu === "more" ? null : "more")} className={iconBtn} aria-label="More">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            <Popover open={menu === "more"} onClose={() => setMenu(null)} className="w-56">
              <MenuItem icon={Download} onClick={exportMarkdown}>Export Markdown</MenuItem>
              <MenuItem icon={Printer} onClick={exportPdf}>Export PDF / Print</MenuItem>
              {isOwner ? (
                <>
                  <MenuItem icon={archived ? ArchiveRestore : Archive} onClick={() => { updateNote(id, { is_archived: !archived }); setMenu(null); toast.success(archived ? "Restored" : "Archived"); }}>
                    {archived ? "Unarchive" : "Archive"}
                  </MenuItem>
                  <div className="my-1 h-px bg-line" />
                  <MenuItem
                    icon={Trash2}
                    danger
                    onClick={async () => {
                      setMenu(null);
                      if (!confirm("Delete this note permanently?")) return;
                      await deleteNote(id);
                      router.replace("/notes");
                    }}
                  >
                    Delete note
                  </MenuItem>
                </>
              ) : (
                <MenuItem
                  icon={LogOut}
                  danger
                  onClick={async () => {
                    setMenu(null);
                    await supabase.from("note_collaborators").delete().match({ note_id: id, user_id: user.id });
                    router.replace("/notes");
                    window.location.reload();
                  }}
                >
                  Leave note
                </MenuItem>
              )}
            </Popover>
          </div>
        </div>
      </header>

      <div className="print-area flex-1 overflow-y-auto">
        <article className="mx-auto max-w-3xl px-6 pt-10 pb-40 sm:px-10 sm:pt-16">
          {(noteTags.length > 0 || isPublic || archived) && (
            <div className="no-print mb-5 flex flex-wrap items-center gap-1.5">
              {archived && <span className="rounded-full bg-fg/[0.07] px-2.5 py-0.5 text-xs font-medium text-muted">Archived</span>}
              {isPublic && <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">Public</span>}
              {noteTags.map((t) => (
                <button
                  key={t!.id}
                  disabled={!isOwner}
                  onClick={() => toggleNoteTag(id, t!.id)}
                  title={isOwner ? "Remove tag" : undefined}
                  className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium transition enabled:hover:line-through", paletteOf(t!.color).soft)}
                >
                  #{t!.name}
                </button>
              ))}
            </div>
          )}
          <NoteEditor
            key={note.id}
            ref={editorRef}
            onReady={setEditorInstance}
            noteId={note.id}
            initialYdoc={note.ydoc}
            initialContent={note.content}
            initialTitle={note.title}
            initialEmoji={note.emoji}
            canEdit={canEdit}
            user={{ id: user.id, name: user.name }}
            onLocalChange={onLocalChange}
            onPeers={setPeers}
            onLiveStatus={setLive}
            onSaveState={setSaveState}
          />
        </article>
      </div>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        note={note}
        isOwner={isOwner}
        currentUserId={user.id}
        onChange={(patch) => {
          setNote((n) => (n ? { ...n, ...patch } : n));
          if ("is_public" in patch) patchLocal(id, { is_public: patch.is_public });
        }}
      />

      <AiPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        editor={editorInstance}
        canEdit={canEdit}
        isOwner={isOwner}
        existingTags={tags.map((t) => t.name)}
        onApplyTags={async (names) => {
          for (const name of names) {
            const t = await createTag(name);
            if (t && !summary?.tag_ids.includes(t.id)) await toggleNoteTag(id, t.id);
          }
        }}
      />
    </div>
  );
}

