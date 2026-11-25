"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Copy, KeyRound, Loader2, MessageCircleQuestion, PenLine, Plus, Sparkles, Tags, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { markdownToHtml } from "./markdown";

type Mode = "summarize" | "rewrite" | "autotag" | "ask";

let enabledCache: boolean | null = null;

export function AiPanel({
  open,
  onClose,
  editor,
  canEdit,
  isOwner,
  existingTags,
  onApplyTags,
}: {
  open: boolean;
  onClose: () => void;
  editor: Editor | null;
  canEdit: boolean;
  isOwner: boolean;
  existingTags: string[];
  onApplyTags: (tags: string[]) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(enabledCache);
  const [mode, setMode] = useState<Mode>("summarize");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [instruction, setInstruction] = useState("");
  const [question, setQuestion] = useState("");

  useEffect(() => {
    if (!open || enabledCache !== null) return;
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d: { enabled: boolean }) => {
        enabledCache = d.enabled;
        setEnabled(d.enabled);
      })
      .catch(() => setEnabled(false));
  }, [open]);

  if (!open) return null;

  const selectionText = () => {
    if (!editor) return "";
    const { from, to, empty } = editor.state.selection;
    return empty ? "" : editor.state.doc.textBetween(from, to, "\n");
  };

  async function run() {
    if (!editor) return;
    setLoading(true);
    setResult("");
    setTags([]);
    try {
      const fullText = editor.getText({ blockSeparator: "\n" });
      const body =
        mode === "rewrite"
          ? { action: mode, text: selectionText() || fullText, instruction }
          : mode === "ask"
            ? { action: mode, question }
            : mode === "autotag"
              ? { action: mode, text: fullText, existingTags }
              : { action: mode, text: fullText };
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI request failed");
      if (mode === "autotag") setTags(data.tags ?? []);
      else setResult(data.result ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  const MODES: { id: Mode; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
    { id: "summarize", label: "Summarize", icon: Sparkles, hint: "A crisp TL;DR of this note." },
    { id: "rewrite", label: "Rewrite", icon: Wand2, hint: "Polish the selection (or whole note)." },
    { id: "autotag", label: "Auto-tag", icon: Tags, hint: "Suggest tags for this note." },
    { id: "ask", label: "Ask notes", icon: MessageCircleQuestion, hint: "Ask a question across all your notes." },
  ];

  return (
    <aside className="no-print glass fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col !rounded-none !border-y-0 !border-r-0 !bg-solid/95 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <span className="bg-gradient-brand grid h-8 w-8 place-items-center rounded-xl text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 className="font-display text-lg font-bold">AI assistant</h2>
        <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-muted hover:bg-fg/[0.06] hover:text-fg" aria-label="Close AI panel">
          <X className="h-4 w-4" />
        </button>
      </div>

      {enabled === false ? (
        <div className="m-5 rounded-2xl border border-dashed border-line-strong p-5 text-sm">
          <KeyRound className="mb-3 h-6 w-6 text-accent" />
          <p className="font-semibold">AI isn&apos;t switched on yet</p>
          <p className="mt-1.5 text-muted">
            Add an <code className="rounded bg-fg/[0.07] px-1">OPENROUTER_API_KEY</code> environment variable in Vercel → Project → Settings →
            Environment Variables, then redeploy. All AI features light up automatically.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  setResult("");
                  setTags([]);
                }}
                className={cn(
                  "rounded-2xl border p-3 text-left transition",
                  mode === m.id ? "border-accent/50 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10" : "border-line hover:border-line-strong",
                )}
              >
                <m.icon className={cn("mb-1.5 h-4 w-4", mode === m.id ? "text-accent" : "text-muted")} />
                <p className="text-sm font-semibold">{m.label}</p>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">{MODES.find((m) => m.id === mode)?.hint}</p>

          {mode === "rewrite" && (
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. make it shorter, more formal…"
              className="mt-3 h-10 w-full rounded-xl border border-line-strong bg-transparent px-3 text-sm outline-none focus:border-accent/50"
            />
          )}
          {mode === "ask" && (
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What did I decide about the launch date?"
              rows={3}
              className="mt-3 w-full resize-none rounded-xl border border-line-strong bg-transparent p-3 text-sm outline-none focus:border-accent/50"
            />
          )}

          <Button className="mt-4 w-full" onClick={run} disabled={loading || enabled === null || (mode === "ask" && !question.trim())}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Thinking…" : "Run"}
          </Button>

          {result && (
            <div className="mt-5 rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
              <p className="text-sm whitespace-pre-wrap">{result}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(result).then(() => toast.success("Copied"))}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                {canEdit && editor && mode === "summarize" && (
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() => {
                      editor.chain().focus().insertContentAt(0, `<blockquote><p><strong>Summary:</strong> ${escapeHtml(result)}</p></blockquote>`).run();
                      toast.success("Summary added to the top");
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Insert at top
                  </Button>
                )}
                {canEdit && editor && mode === "rewrite" && (
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() => {
                      const html = markdownToHtml(result);
                      const { empty } = editor.state.selection;
                      if (empty) editor.chain().focus().setContent(html).run();
                      else editor.chain().focus().insertContent(html).run();
                      toast.success("Replaced");
                    }}
                  >
                    <PenLine className="h-3.5 w-3.5" /> Replace
                  </Button>
                )}
              </div>
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-5 rounded-2xl border border-line p-4">
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-300">
                    #{t}
                  </span>
                ))}
              </div>
              {isOwner ? (
                <Button size="sm" variant="soft" className="mt-3" onClick={() => onApplyTags(tags).then(() => toast.success("Tags added"))}>
                  <Plus className="h-3.5 w-3.5" /> Add all to note
                </Button>
              ) : (
                <p className="mt-2 text-xs text-muted">Only the owner can tag this note.</p>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
