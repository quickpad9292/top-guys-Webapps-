"use client";

import { useEffect, useImperativeHandle, useMemo, useState, forwardRef } from "react";
import type { Editor } from "@tiptap/react";
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Cmd = {
  title: string;
  hint: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  run: (editor: Editor) => void;
};

export const SLASH_COMMANDS = (onImage: () => void): Cmd[] => [
  { title: "Text", hint: "Plain paragraph", keywords: "paragraph p", icon: Type, run: (e) => e.chain().focus().setParagraph().run() },
  { title: "Heading 1", hint: "Big section title", keywords: "h1 title", icon: Heading1, run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
  { title: "Heading 2", hint: "Medium heading", keywords: "h2 subtitle", icon: Heading2, run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { title: "Heading 3", hint: "Small heading", keywords: "h3", icon: Heading3, run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { title: "To-do list", hint: "Track tasks with checkboxes", keywords: "todo task checkbox check", icon: CheckSquare, run: (e) => e.chain().focus().toggleTaskList().run() },
  { title: "Bulleted list", hint: "Simple bullets", keywords: "ul bullet unordered", icon: List, run: (e) => e.chain().focus().toggleBulletList().run() },
  { title: "Numbered list", hint: "Ordered steps", keywords: "ol ordered number", icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: "Quote", hint: "Call out a quote", keywords: "blockquote citation", icon: Quote, run: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: "Code block", hint: "Monospaced snippet", keywords: "code pre snippet", icon: Code2, run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { title: "Highlight", hint: "Marker pen", keywords: "mark highlight", icon: Highlighter, run: (e) => e.chain().focus().toggleHighlight().run() },
  { title: "Divider", hint: "Horizontal rule", keywords: "hr line separator", icon: Minus, run: (e) => e.chain().focus().setHorizontalRule().run() },
  { title: "Image", hint: "Upload from your device", keywords: "picture photo upload img", icon: ImageIcon, run: () => onImage() },
];

export type SlashState = { from: number; to: number; query: string; left: number; top: number } | null;

/** Detect "/query" right before the cursor at the start of a word. */
export function readSlash(editor: Editor): SlashState {
  const { state, view } = editor;
  const { selection } = state;
  if (!selection.empty) return null;
  const $from = selection.$from;
  if ($from.parent.type.name === "codeBlock") return null;
  const textBefore = $from.parent.textBetween(Math.max(0, $from.parentOffset - 40), $from.parentOffset, undefined, "￼");
  const m = /(?:^|\s)\/([\w-]{0,20})$/.exec(textBefore);
  if (!m) return null;
  const from = $from.pos - m[1].length - 1;
  const coords = view.coordsAtPos(from);
  return { from, to: $from.pos, query: m[1].toLowerCase(), left: coords.left, top: coords.bottom };
}

export type SlashMenuHandle = { onKeyDown: (e: KeyboardEvent) => boolean };

export const SlashMenu = forwardRef<SlashMenuHandle, { editor: Editor; state: SlashState; onImage: () => void; onClose: () => void }>(
  function SlashMenu({ editor, state, onImage, onClose }, ref) {
    const commands = useMemo(() => SLASH_COMMANDS(onImage), [onImage]);
    const items = useMemo(() => {
      if (!state) return [];
      const q = state.query;
      return commands.filter((c) => !q || c.title.toLowerCase().includes(q) || c.keywords.includes(q));
    }, [commands, state]);
    const [index, setIndex] = useState(0);
    const query = state?.query;

    useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIndex(0);
    }, [query]);

    const select = (i: number) => {
      const cmd = items[i];
      if (!cmd || !state) return;
      editor.chain().focus().deleteRange({ from: state.from, to: state.to }).run();
      cmd.run(editor);
      onClose();
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: (e) => {
        if (!state || items.length === 0) return false;
        if (e.key === "ArrowDown") {
          setIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (e.key === "ArrowUp") {
          setIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          select(index);
          return true;
        }
        if (e.key === "Escape") {
          onClose();
          return true;
        }
        return false;
      },
    }));

    if (!state || items.length === 0) return null;

    const top = Math.min(state.top + 8, window.innerHeight - 340);
    const left = Math.min(state.left, window.innerWidth - 290);

    return (
      <div
        className="glass fixed z-50 w-72 overflow-hidden rounded-2xl !bg-solid/95 p-1.5"
        style={{ top, left }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Blocks</p>
        <div className="max-h-72 overflow-y-auto">
          {items.map((c, i) => (
            <button
              key={c.title}
              onMouseEnter={() => setIndex(i)}
              onClick={() => select(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition",
                i === index ? "bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10" : "hover:bg-fg/[0.04]",
              )}
            >
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-solid", i === index && "border-accent/40 text-accent")}>
                <c.icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-medium">{c.title}</span>
                <span className="block text-xs text-muted">{c.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  },
);
