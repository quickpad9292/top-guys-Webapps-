"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Globe, Loader2, Lock, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn, randomToken } from "@/lib/utils";
import type { Collaborator, Note, Profile } from "@/lib/types";
import { Button, Input, Modal } from "@/components/ui";

export function ShareDialog({
  open,
  onClose,
  note,
  isOwner,
  currentUserId,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  note: Note;
  isOwner: boolean;
  currentUserId: string;
  onChange: (patch: Partial<Note>) => void;
}) {
  const supabase = createClient();
  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("note_collaborators").select("note_id,user_id,role").eq("note_id", note.id);
    const rows = (data ?? []) as Collaborator[];
    const ids = [...rows.map((r) => r.user_id), note.user_id];
    const { data: profiles } = await supabase.from("profiles").select("id,email,display_name,avatar_url").in("id", ids);
    const byId = new Map(((profiles ?? []) as Profile[]).map((p) => [p.id, p] as const));
    setCollabs(rows.map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null })));
  }, [supabase, note.id, note.user_id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) load();
  }, [open, load]);

  const link = note.share_token ? `${typeof window !== "undefined" ? window.location.origin : ""}/s/${note.share_token}` : "";

  async function togglePublic() {
    setBusy(true);
    const next = !note.is_public;
    const patch = { is_public: next, share_token: note.share_token ?? randomToken() };
    const { error } = await supabase.from("notes").update(patch).eq("id", note.id);
    setBusy(false);
    if (error) return void toast.error(error.message);
    onChange(patch);
    toast.success(next ? "Public link enabled" : "Public link disabled");
  }

  async function regenerate() {
    const share_token = randomToken();
    const { error } = await supabase.from("notes").update({ share_token }).eq("id", note.id);
    if (error) return void toast.error(error.message);
    onChange({ share_token });
    toast.success("New link created — the old one no longer works");
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("invite_collaborator", { p_note_id: note.id, p_email: email.trim(), p_role: role });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(`Invited ${email.trim()}`);
    setEmail("");
    load();
  }

  async function remove(userId: string) {
    const { error } = await supabase.from("note_collaborators").delete().match({ note_id: note.id, user_id: userId });
    if (error) return void toast.error(error.message);
    if (userId === currentUserId) {
      toast.success("You left this note");
      window.location.href = "/notes";
      return;
    }
    setCollabs((c) => c.filter((x) => x.user_id !== userId));
  }

  async function changeRole(userId: string, newRole: "editor" | "viewer") {
    const { error } = await supabase.from("note_collaborators").update({ role: newRole }).match({ note_id: note.id, user_id: userId });
    if (error) return void toast.error(error.message);
    setCollabs((c) => c.map((x) => (x.user_id === userId ? { ...x, role: newRole } : x)));
  }

  return (
    <Modal open={open} onClose={onClose} title="Share note" className="max-w-xl">
      <div className="space-y-6">
        <section className="rounded-2xl border border-line p-4">
          <div className="flex items-center gap-3">
            <div className={cn("grid h-10 w-10 place-items-center rounded-xl", note.is_public ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-fg/[0.06] text-muted")}>
              {note.is_public ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <p className="font-semibold">Public link</p>
              <p className="text-xs text-muted">{note.is_public ? "Anyone with the link can read this note." : "Only you and invited people can open it."}</p>
            </div>
            {isOwner && (
              <button
                role="switch"
                aria-checked={note.is_public}
                onClick={togglePublic}
                disabled={busy}
                className={cn("relative h-6 w-11 rounded-full transition", note.is_public ? "bg-gradient-brand" : "bg-fg/15")}
              >
                <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", note.is_public ? "left-[22px]" : "left-0.5")} />
              </button>
            )}
          </div>
          {note.is_public && link && (
            <div className="mt-4 flex gap-2">
              <Input readOnly value={link} className="h-10 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button
                variant="outline"
                className="h-10"
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}
          {note.is_public && isOwner && (
            <button onClick={regenerate} className="mt-2 text-xs text-muted hover:text-fg hover:underline">
              Reset link (revokes the current one)
            </button>
          )}
        </section>

        <section>
          <p className="mb-2 font-semibold">People with access</p>
          {isOwner && (
            <form onSubmit={invite} className="mb-3 flex gap-2">
              <Input type="email" required placeholder="teammate@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
                className="h-10 rounded-xl border border-line-strong bg-solid/70 px-2 text-sm"
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
              <Button type="submit" className="h-10" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Invite
              </Button>
            </form>
          )}
          {isOwner && <p className="mb-3 text-xs text-muted">They need a Cognithan account with that email. Invited people can edit live with you.</p>}
          <ul className="space-y-1">
            {collabs.length === 0 && <li className="py-2 text-sm text-muted">No one else has access yet.</li>}
            {collabs.map((c) => (
              <li key={c.user_id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-fg/[0.03]">
                <span className="bg-gradient-brand grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white uppercase">
                  {(c.profile?.display_name ?? c.profile?.email ?? "?").slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.profile?.display_name ?? "Collaborator"}{c.user_id === currentUserId && " (you)"}</p>
                  <p className="truncate text-xs text-muted">{c.profile?.email}</p>
                </div>
                {isOwner ? (
                  <select
                    value={c.role}
                    onChange={(e) => changeRole(c.user_id, e.target.value as "editor" | "viewer")}
                    className="h-8 rounded-lg border border-line bg-transparent px-1.5 text-xs"
                  >
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                ) : (
                  <span className="text-xs text-muted">{c.role === "editor" ? "Can edit" : "Can view"}</span>
                )}
                {(isOwner || c.user_id === currentUserId) && (
                  <button onClick={() => remove(c.user_id)} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500" aria-label="Remove access">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
