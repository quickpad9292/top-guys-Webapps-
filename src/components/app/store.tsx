"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Folder, NoteSummary, Tag } from "@/lib/types";

export type SessionUser = { id: string; email: string; name: string };

export type View =
  | { kind: "all" }
  | { kind: "pinned" }
  | { kind: "shared" }
  | { kind: "archived" }
  | { kind: "folder"; id: string }
  | { kind: "tag"; id: string };

type Store = {
  user: SessionUser;
  notes: NoteSummary[];
  folders: Folder[];
  tags: Tag[];
  loading: boolean;
  view: View;
  setView: (v: View) => void;
  query: string;
  setQuery: (q: string) => void;
  visibleNotes: NoteSummary[];
  searching: boolean;
  refresh: () => Promise<void>;
  createNote: (opts?: { folderId?: string | null; title?: string }) => Promise<string | null>;
  updateNote: (id: string, patch: Partial<NoteSummary>) => Promise<void>;
  patchLocal: (id: string, patch: Partial<NoteSummary>) => void;
  deleteNote: (id: string) => Promise<void>;
  createFolder: (name: string, color?: string) => Promise<Folder | null>;
  updateFolder: (id: string, patch: Partial<Folder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  createTag: (name: string, color?: string) => Promise<Tag | null>;
  updateTag: (id: string, patch: Partial<Tag>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  toggleNoteTag: (noteId: string, tagId: string) => Promise<void>;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
};

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <NotesProvider>");
  return s;
}

const NOTE_FIELDS =
  "id,user_id,folder_id,title,emoji,is_pinned,is_archived,is_public,updated_at,created_at,preview,note_tags(tag_id)";

type NoteRow = Omit<NoteSummary, "tag_ids" | "shared" | "preview"> & {
  preview: string | null;
  note_tags: { tag_id: string }[] | null;
};

function toSummary(row: NoteRow, userId: string): NoteSummary {
  const { note_tags, ...rest } = row;
  return {
    ...rest,
    preview: row.preview ?? "",
    tag_ids: (note_tags ?? []).map((t) => t.tag_id),
    shared: row.user_id !== userId,
  };
}

export function NotesProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [matchIds, setMatchIds] = useState<Set<string> | null>(null);
  const [searching, setSearching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [n, f, t] = await Promise.all([
      supabase.from("notes").select(NOTE_FIELDS).order("updated_at", { ascending: false }).limit(1000),
      supabase.from("folders").select("*").order("position").order("created_at"),
      supabase.from("tags").select("*").order("name"),
    ]);
    if (n.error || f.error || t.error) {
      toast.error((n.error ?? f.error ?? t.error)?.message ?? "Failed to load notes");
    }
    setNotes(((n.data ?? []) as NoteRow[]).map((r) => toSummary(r, user.id)));
    setFolders((f.data ?? []) as Folder[]);
    setTags((t.data ?? []) as Tag[]);
    setLoading(false);
  }, [supabase, user.id]);

  useEffect(() => {
    // Initial load; refresh also when the tab regains focus.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // Debounced server-side search over title + full text.
  const searchSeq = useRef(0);
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMatchIds(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const handle = setTimeout(async () => {
      // PostgREST filter syntax: strip characters that would break the or() expression.
      const escaped = q.replace(/[%_,()\\*:"']/g, " ").trim() || "_";
      const { data, error } = await supabase
        .from("notes")
        .select("id")
        .or(`title.ilike.%${escaped}%,content_text.ilike.%${escaped}%`)
        .limit(500);
      if (seq !== searchSeq.current) return;
      if (error) toast.error(error.message);
      setMatchIds(new Set((data ?? []).map((d: { id: string }) => d.id)));
      setSearching(false);
    }, 180);
    return () => clearTimeout(handle);
  }, [query, supabase]);

  const visibleNotes = useMemo(() => {
    let list = notes;
    if (matchIds) list = list.filter((n) => matchIds.has(n.id));
    switch (view.kind) {
      case "archived":
        list = list.filter((n) => n.is_archived);
        break;
      case "pinned":
        list = list.filter((n) => n.is_pinned && !n.is_archived);
        break;
      case "shared":
        list = list.filter((n) => n.shared);
        break;
      case "folder":
        list = list.filter((n) => n.folder_id === view.id && !n.is_archived);
        break;
      case "tag":
        list = list.filter((n) => n.tag_ids.includes(view.id) && !n.is_archived);
        break;
      default:
        list = list.filter((n) => !n.is_archived);
    }
    return [...list].sort(
      (a, b) =>
        Number(b.is_pinned && !b.shared) - Number(a.is_pinned && !a.shared) ||
        b.updated_at.localeCompare(a.updated_at),
    );
  }, [notes, view, matchIds]);

  const patchLocal = useCallback((id: string, patch: Partial<NoteSummary>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const createNote: Store["createNote"] = useCallback(
    async (opts) => {
      const folderId = opts?.folderId ?? (view.kind === "folder" ? view.id : null);
      const { data, error } = await supabase
        .from("notes")
        .insert({ user_id: user.id, folder_id: folderId, title: opts?.title ?? "" })
        .select(NOTE_FIELDS)
        .single();
      if (error || !data) {
        toast.error(error?.message ?? "Could not create note");
        return null;
      }
      const summary = toSummary(data as NoteRow, user.id);
      if (view.kind === "tag") {
        await supabase.from("note_tags").insert({ note_id: summary.id, tag_id: view.id });
        summary.tag_ids = [view.id];
      }
      setNotes((prev) => [summary, ...prev]);
      router.push(`/notes/${summary.id}`);
      return summary.id;
    },
    [supabase, user.id, view, router],
  );

  const updateNote: Store["updateNote"] = useCallback(
    async (id, patch) => {
      patchLocal(id, patch);
      const allowed: Record<string, unknown> = {};
      for (const k of ["folder_id", "title", "emoji", "is_pinned", "is_archived", "is_public"] as const) {
        if (k in patch) allowed[k] = patch[k];
      }
      const { error } = await supabase.from("notes").update(allowed).eq("id", id);
      if (error) {
        toast.error(error.message);
        refresh();
      }
    },
    [supabase, patchLocal, refresh],
  );

  const deleteNote: Store["deleteNote"] = useCallback(
    async (id) => {
      const prev = notes;
      setNotes((p) => p.filter((n) => n.id !== id));
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) {
        toast.error(error.message);
        setNotes(prev);
      } else {
        toast.success("Note deleted");
      }
    },
    [supabase, notes],
  );

  const createFolder: Store["createFolder"] = useCallback(
    async (name, color = "violet") => {
      const { data, error } = await supabase
        .from("folders")
        .insert({ user_id: user.id, name, color, position: folders.length })
        .select("*")
        .single();
      if (error) {
        toast.error(error.message);
        return null;
      }
      setFolders((p) => [...p, data as Folder]);
      return data as Folder;
    },
    [supabase, user.id, folders.length],
  );

  const updateFolder: Store["updateFolder"] = useCallback(
    async (id, patch) => {
      setFolders((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)));
      const { error } = await supabase.from("folders").update(patch).eq("id", id);
      if (error) toast.error(error.message);
    },
    [supabase],
  );

  const deleteFolder: Store["deleteFolder"] = useCallback(
    async (id) => {
      const { error } = await supabase.from("folders").delete().eq("id", id);
      if (error) return void toast.error(error.message);
      setFolders((p) => p.filter((f) => f.id !== id));
      setNotes((p) => p.map((n) => (n.folder_id === id ? { ...n, folder_id: null } : n)));
      setView({ kind: "all" });
    },
    [supabase],
  );

  const createTag: Store["createTag"] = useCallback(
    async (name, color = "fuchsia") => {
      const clean = name.trim().replace(/^#/, "").slice(0, 40);
      if (!clean) return null;
      const existing = tags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
      if (existing) return existing;
      const { data, error } = await supabase
        .from("tags")
        .insert({ user_id: user.id, name: clean, color })
        .select("*")
        .single();
      if (error) {
        toast.error(error.message);
        return null;
      }
      setTags((p) => [...p, data as Tag].sort((a, b) => a.name.localeCompare(b.name)));
      return data as Tag;
    },
    [supabase, user.id, tags],
  );

  const updateTag: Store["updateTag"] = useCallback(
    async (id, patch) => {
      setTags((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      const { error } = await supabase.from("tags").update(patch).eq("id", id);
      if (error) toast.error(error.message);
    },
    [supabase],
  );

  const deleteTag: Store["deleteTag"] = useCallback(
    async (id) => {
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) return void toast.error(error.message);
      setTags((p) => p.filter((t) => t.id !== id));
      setNotes((p) => p.map((n) => ({ ...n, tag_ids: n.tag_ids.filter((t) => t !== id) })));
      setView({ kind: "all" });
    },
    [supabase],
  );

  const toggleNoteTag: Store["toggleNoteTag"] = useCallback(
    async (noteId, tagId) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      const has = note.tag_ids.includes(tagId);
      patchLocal(noteId, {
        tag_ids: has ? note.tag_ids.filter((t) => t !== tagId) : [...note.tag_ids, tagId],
      });
      const { error } = has
        ? await supabase.from("note_tags").delete().match({ note_id: noteId, tag_id: tagId })
        : await supabase.from("note_tags").insert({ note_id: noteId, tag_id: tagId });
      if (error) {
        toast.error(error.message);
        refresh();
      }
    },
    [supabase, notes, patchLocal, refresh],
  );

  const value: Store = {
    user,
    notes,
    folders,
    tags,
    loading,
    view,
    setView,
    query,
    setQuery,
    visibleNotes,
    searching,
    refresh,
    createNote,
    updateNote,
    patchLocal,
    deleteNote,
    createFolder,
    updateFolder,
    deleteFolder,
    createTag,
    updateTag,
    deleteTag,
    toggleNoteTag,
    sidebarOpen,
    setSidebarOpen,
    paletteOpen,
    setPaletteOpen,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
