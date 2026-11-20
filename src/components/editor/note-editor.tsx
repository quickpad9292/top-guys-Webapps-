"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as Y from "yjs";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Collaboration from "@tiptap/extension-collaboration";
import { toast } from "sonner";
import { Bold, Code, Heading1, Heading2, Highlighter, Italic, Link2, Strikethrough, Underline } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SupabaseYProvider, type Peer } from "@/lib/collab";
import { cn, colorForId, fromBase64, toBase64 } from "@/lib/utils";
import { readSlash, SlashMenu, type SlashMenuHandle, type SlashState } from "./slash-menu";
import { uploadImage } from "./upload";

export type SaveState = "saved" | "saving" | "unsaved" | "error";
export type LiveStatus = "connecting" | "live" | "offline";

export type NoteEditorHandle = {
  editor: Editor | null;
  setEmoji: (emoji: string | null) => void;
  flush: () => Promise<void>;
};

type Props = {
  noteId: string;
  initialYdoc: string | null;
  initialContent: unknown;
  initialTitle: string;
  initialEmoji: string | null;
  canEdit: boolean;
  user: { id: string; name: string };
  onLocalChange: (patch: { title?: string; emoji?: string | null; preview?: string; updated_at?: string }) => void;
  onPeers: (peers: Peer[]) => void;
  onLiveStatus: (s: LiveStatus) => void;
  onSaveState: (s: SaveState) => void;
  onReady?: (editor: Editor | null) => void;
};

const EMPTY_DOC_TYPES = new Set(["doc"]);

function hasContent(json: unknown) {
  const j = json as { type?: string; content?: unknown[] } | null;
  return Boolean(j && EMPTY_DOC_TYPES.has(j.type ?? "") && Array.isArray(j.content) && j.content.length > 0);
}

export const NoteEditor = forwardRef<NoteEditorHandle, Props>(function NoteEditor(props, ref) {
  const { noteId, canEdit, user } = props;
  const supabase = createClient();

  // One Y.Doc per mounted note; seeded from the stored Yjs state (safe to merge on every client).
  const [doc] = useState(() => {
    const d = new Y.Doc();
    if (props.initialYdoc) {
      try {
        Y.applyUpdate(d, fromBase64(props.initialYdoc), "db");
      } catch {
        /* corrupted state: start fresh */
      }
    }
    const meta = d.getMap<string | null>("meta");
    if (meta.get("title") === undefined && props.initialTitle) {
      d.transact(() => meta.set("title", props.initialTitle), "db");
    }
    if (meta.get("emoji") === undefined && props.initialEmoji) {
      d.transact(() => meta.set("emoji", props.initialEmoji), "db");
    }
    return d;
  });
  const meta = doc.getMap<string | null>("meta");

  const [title, setTitle] = useState<string>(() => (meta.get("title") as string) ?? "");
  const [emoji, setEmojiState] = useState<string | null>(() => (meta.get("emoji") as string | null) ?? null);

  const providerRef = useRef<SupabaseYProvider | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshot = useRef<{ json: unknown; text: string } | null>(null);
  const saving = useRef<Promise<void> | null>(null);
  const cb = useRef(props);
  useEffect(() => {
    cb.current = props;
  });

  const save = useCallback(async () => {
    if (!canEdit || !dirty.current) return;
    if (saving.current) await saving.current;
    if (!dirty.current) return;
    dirty.current = false;
    cb.current.onSaveState("saving");
    const snap = snapshot.current;
    const payload: Record<string, unknown> = {
      title: (meta.get("title") as string) ?? "",
      emoji: (meta.get("emoji") as string | null) ?? null,
      ydoc: toBase64(Y.encodeStateAsUpdate(doc)),
    };
    if (snap) {
      payload.content = snap.json;
      payload.content_text = snap.text;
    }
    const run = (async () => {
      const { error } = await supabase.from("notes").update(payload).eq("id", noteId);
      if (error) {
        dirty.current = true;
        cb.current.onSaveState("error");
        toast.error(`Couldn't save: ${error.message}`);
      } else {
        cb.current.onSaveState(dirty.current ? "unsaved" : "saved");
      }
    })();
    saving.current = run;
    await run;
    saving.current = null;
  }, [canEdit, doc, meta, noteId, supabase]);

  const schedule = useCallback(() => {
    dirty.current = true;
    cb.current.onSaveState("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 900);
  }, [save]);

  // Track local changes → autosave. Remote updates are saved by whoever made them.
  useEffect(() => {
    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin === providerRef.current || origin === "db") return;
      if (canEdit) schedule();
    };
    doc.on("update", onUpdate);
    const onMeta = () => {
      const t = (meta.get("title") as string) ?? "";
      const e = (meta.get("emoji") as string | null) ?? null;
      setTitle(t);
      setEmojiState(e);
      cb.current.onLocalChange({ title: t, emoji: e });
    };
    meta.observe(onMeta);
    return () => {
      doc.off("update", onUpdate);
      meta.unobserve(onMeta);
    };
  }, [doc, meta, canEdit, schedule]);

  // Realtime provider (live co-editing + presence)
  useEffect(() => {
    const provider = new SupabaseYProvider(
      supabase,
      noteId,
      doc,
      { user_id: user.id, name: user.name, color: colorForId(user.id) },
      (peers) => cb.current.onPeers(peers),
      (s) => cb.current.onLiveStatus(s),
    );
    providerRef.current = provider;
    provider.connect().catch(() => cb.current.onLiveStatus("offline"));
    return () => {
      provider.destroy();
      providerRef.current = null;
    };
  }, [supabase, noteId, doc, user.id, user.name]);

  // Flush on tab hide / unload / unmount
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void save();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        void save();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
      if (timer.current) clearTimeout(timer.current);
      void save();
    };
  }, [save]);

  // ----- Slash menu -----
  const slashRef = useRef<SlashMenuHandle>(null);
  const [slash, setSlash] = useState<SlashState>(null);
  const dismissedAt = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const insertFiles = useCallback(
    async (editor: Editor, files: File[], pos?: number) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (!images.length) return false;
      const id = toast.loading(images.length > 1 ? `Uploading ${images.length} images…` : "Uploading image…");
      try {
        for (const file of images) {
          const src = await uploadImage(file, user.id, noteId);
          const chain = editor.chain().focus();
          if (pos !== undefined) chain.insertContentAt(pos, { type: "image", attrs: { src, alt: file.name } });
          else chain.setImage({ src, alt: file.name });
          chain.run();
        }
        toast.success("Image added", { id });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed", { id });
      }
      return true;
    },
    [user.id, noteId],
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable: canEdit,
    extensions: [
      StarterKit.configure({
        undoRedo: false, // Yjs provides collaborative undo
        link: { openOnClick: false, autolink: true, HTMLAttributes: { class: "text-accent underline underline-offset-2" } },
        heading: { levels: [1, 2, 3] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ HTMLAttributes: { loading: "lazy" } }),
      Highlight,
      Typography,
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? "Heading" : canEdit ? "Type '/' for commands, or just start writing…" : "",
      }),
      Collaboration.configure({ document: doc, field: "default" }),
    ],
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-neutral dark:prose-invert max-w-none prose-headings:font-display prose-headings:tracking-tight prose-h1:text-3xl prose-a:text-accent prose-blockquote:border-l-accent prose-blockquote:not-italic prose-code:before:content-none prose-code:after:content-none prose-code:rounded-md prose-code:bg-fg/[0.07] prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal prose-pre:my-0 focus:outline-none",
      },
      handleKeyDown: (_view, event) => slashRef.current?.onKeyDown(event) ?? false,
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.some((f) => f.type.startsWith("image/")) || !editorRef.current) return false;
        event.preventDefault();
        void insertFiles(editorRef.current, files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (!files.some((f) => f.type.startsWith("image/")) || !editorRef.current) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertFiles(editorRef.current, files, pos);
        return true;
      },
    },
    onCreate: ({ editor }) => {
      // Legacy notes without Yjs state: seed once from stored JSON.
      if (canEdit && !props.initialYdoc && hasContent(props.initialContent) && editor.isEmpty) {
        editor.commands.setContent(props.initialContent as Parameters<typeof editor.commands.setContent>[0]);
      }
      snapshot.current = { json: editor.getJSON(), text: editor.getText({ blockSeparator: "\n" }) };
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText({ blockSeparator: "\n" });
      snapshot.current = { json: editor.getJSON(), text };
      cb.current.onLocalChange({ preview: text.slice(0, 200), updated_at: new Date().toISOString() });
    },
    onTransaction: ({ editor }) => {
      if (!editor.isEditable) return;
      const s = readSlash(editor);
      if (s && dismissedAt.current === s.from) return setSlash(null);
      if (!s) dismissedAt.current = null;
      setSlash(s);
    },
    onBlur: () => setSlash(null),
  });

  const editorRef = useRef<Editor | null>(null);
  useEffect(() => {
    editorRef.current = editor;
    cb.current.onReady?.(editor);
  }, [editor]);

  useEffect(() => {
    editor?.setEditable(canEdit);
  }, [editor, canEdit]);

  useImperativeHandle(
    ref,
    () => ({
      editor,
      setEmoji: (e) => doc.transact(() => meta.set("emoji", e)),
      flush: save,
    }),
    [editor, doc, meta, save],
  );

  const titleRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [title]);

  return (
    <div>
      {emoji && <div className="mb-2 text-5xl leading-none select-none sm:text-6xl">{emoji}</div>}
      <textarea
        ref={titleRef}
        value={title}
        readOnly={!canEdit}
        rows={1}
        placeholder="Untitled"
        onChange={(e) => {
          const v = e.target.value.replace(/\n/g, " ").slice(0, 300);
          doc.transact(() => meta.set("title", v));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "ArrowDown") {
            e.preventDefault();
            editor?.commands.focus("start");
          }
        }}
        className="w-full resize-none overflow-hidden bg-transparent font-display text-4xl leading-tight font-extrabold tracking-tight outline-none placeholder:text-fg/20 sm:text-5xl"
      />

      <div className="mt-4">
        {editor && canEdit && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor, state }) =>
              !state.selection.empty && !editor.isActive("image") && !editor.isActive("codeBlock")
            }
            className="glass flex items-center gap-0.5 rounded-xl !bg-solid/95 p-1"
          >
            {[
              { icon: Bold, label: "Bold", active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
              { icon: Italic, label: "Italic", active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
              { icon: Underline, label: "Underline", active: editor.isActive("underline"), run: () => editor.chain().focus().toggleUnderline().run() },
              { icon: Strikethrough, label: "Strike", active: editor.isActive("strike"), run: () => editor.chain().focus().toggleStrike().run() },
              { icon: Highlighter, label: "Highlight", active: editor.isActive("highlight"), run: () => editor.chain().focus().toggleHighlight().run() },
              { icon: Code, label: "Code", active: editor.isActive("code"), run: () => editor.chain().focus().toggleCode().run() },
              { icon: Heading1, label: "Heading 1", active: editor.isActive("heading", { level: 1 }), run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
              { icon: Heading2, label: "Heading 2", active: editor.isActive("heading", { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
              {
                icon: Link2,
                label: "Link",
                active: editor.isActive("link"),
                run: () => {
                  const prev = editor.getAttributes("link").href as string | undefined;
                  const url = window.prompt("Link URL", prev ?? "https://");
                  if (url === null) return;
                  if (!url) editor.chain().focus().unsetLink().run();
                  else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                },
              },
            ].map(({ icon: Icon, label, active, run }) => (
              <button
                key={label}
                onClick={run}
                title={label}
                aria-label={label}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg transition",
                  active ? "bg-gradient-brand text-white" : "text-fg/75 hover:bg-fg/[0.07] hover:text-fg",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </BubbleMenu>
        )}

        <EditorContent editor={editor} />

        {editor && (
          <SlashMenu
            ref={slashRef}
            editor={editor}
            state={slash}
            onImage={() => fileInput.current?.click()}
            onClose={() => {
              if (slash) dismissedAt.current = slash.from;
              setSlash(null);
            }}
          />
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (editor && files.length) void insertFiles(editor, files);
          }}
        />
      </div>
    </div>
  );
});
