import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui";
import { ReadOnlyNote } from "@/components/editor/read-only";

type Shared = { id: string; title: string; emoji: string | null; content: unknown; updated_at: string; author: string | null };

async function load(token: string): Promise<Shared | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_shared_note", { p_token: token });
  return ((data as Shared[] | null) ?? [])[0] ?? null;
}

export async function generateMetadata({ params }: PageProps<"/s/[token]">): Promise<Metadata> {
  const { token } = await params;
  const note = await load(token);
  return {
    title: note ? `${note.emoji ? note.emoji + " " : ""}${note.title || "Untitled"}` : "Note not found",
    robots: { index: false },
  };
}

export default async function SharedNotePage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const note = await load(token);
  if (!note) notFound();

  return (
    <main className="min-h-dvh">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-violet-500/15 via-fuchsia-500/5 to-transparent" />
      <header className="no-print mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <span className="font-display font-bold">Cognithan</span>
        </Link>
        <Link href="/signup" className="bg-gradient-brand rounded-xl px-3.5 py-1.5 text-sm font-semibold text-white">
          Try it free
        </Link>
      </header>
      <article className="mx-auto max-w-3xl px-6 pt-8 pb-32">
        {note.emoji && <div className="mb-2 text-6xl">{note.emoji}</div>}
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{note.title || "Untitled"}</h1>
        <p className="mt-3 text-sm text-muted">
          {note.author ? `By ${note.author} · ` : ""}Updated{" "}
          {new Date(note.updated_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
        </p>
        <div className="mt-10">
          <ReadOnlyNote content={note.content} />
        </div>
      </article>
    </main>
  );
}
