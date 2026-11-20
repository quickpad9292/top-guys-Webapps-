import Link from "next/link";
import {
  ArrowRight,
  Command,
  FolderTree,
  ImagePlus,
  Share2,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Backdrop } from "@/components/backdrop";
import { Logo } from "@/components/ui";

const FEATURES = [
  { icon: Zap, title: "Block editor", body: "Headings, checklists, code, images — type / for anything." },
  { icon: Users, title: "Live co-editing", body: "Invite teammates and write together, conflict-free." },
  { icon: FolderTree, title: "Folders & tags", body: "Colourful structure that stays out of your way." },
  { icon: Sparkles, title: "AI built in", body: "Summarize, rewrite, auto-tag and ask your notes." },
  { icon: Share2, title: "One-click sharing", body: "Publish a beautiful read-only link, revoke anytime." },
  { icon: Command, title: "Keyboard first", body: "⌘K command palette and shortcuts everywhere." },
  { icon: ImagePlus, title: "Drop in images", body: "Paste or drag images straight into a note." },
];

export default function Landing() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Backdrop />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-xl font-bold tracking-tight">Cognithan</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-xl px-4 py-2 font-medium text-fg/80 hover:text-fg">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="bg-gradient-brand rounded-xl px-4 py-2 font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition hover:brightness-110"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-5 pt-14 pb-20 text-center sm:pt-24">
        <div className="glass mx-auto mb-7 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted">
          <span className="bg-gradient-brand h-2 w-2 rounded-full" />
          Real-time collaboration · AI-ready · Installable
        </div>
        <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl md:text-8xl">
          Notes that
          <br />
          <span className="text-gradient animate-shimmer">think with you.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-lg text-muted">
          Capture ideas at the speed of thought. Organize them with colour, write together live, and
          let AI do the busywork.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="bg-gradient-brand group inline-flex h-13 items-center gap-2 rounded-2xl px-7 text-base font-semibold text-white shadow-xl shadow-fuchsia-500/30 transition hover:brightness-110"
          >
            Start writing — it&apos;s free
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/login"
            className="glass inline-flex h-13 items-center rounded-2xl px-7 text-base font-semibold"
          >
            I have an account
          </Link>
        </div>

        <div className="glass relative mx-auto mt-20 max-w-4xl rounded-[2rem] p-3 text-left">
          <div className="rounded-[1.5rem] border border-line bg-solid/80 p-6 sm:p-10">
            <div className="mb-6 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <div className="ml-auto flex -space-x-2">
                {["bg-violet-500", "bg-fuchsia-500", "bg-orange-500"].map((c, i) => (
                  <span
                    key={c}
                    className={`${c} grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-white ring-2 ring-[var(--bg-solid)]`}
                  >
                    {"AMJ"[i]}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-3xl">🚀</p>
            <h3 className="mt-2 font-display text-3xl font-bold">Launch plan</h3>
            <div className="mt-3 flex gap-2">
              <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                #product
              </span>
              <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-300">
                #q4
              </span>
            </div>
            <ul className="mt-5 space-y-2.5 text-[15px]">
              <li className="flex items-center gap-3">
                <span className="bg-gradient-brand grid h-4 w-4 place-items-center rounded text-[10px] text-white">✓</span>
                <span className="text-muted line-through">Finalize pricing page</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="h-4 w-4 rounded border-[1.5px] border-line-strong" />
                Record the demo video
                <span className="ml-1 inline-block h-5 w-0.5 animate-pulse bg-fuchsia-500" />
                <span className="rounded bg-fuchsia-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">Maya</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="h-4 w-4 rounded border-[1.5px] border-line-strong" />
                Ship v1 to production
              </li>
            </ul>
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/[0.07] p-4 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
              <p>
                <span className="font-semibold">AI summary:</span> Pricing is done; the demo video is
                in progress and the launch is the last remaining step.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-28 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, body }, i) => (
          <div
            key={title}
            className={`glass group rounded-3xl p-6 transition hover:-translate-y-1 ${i === 0 ? "lg:col-span-2" : ""}`}
          >
            <div className="bg-gradient-brand mb-4 grid h-11 w-11 place-items-center rounded-2xl text-white shadow-lg shadow-fuchsia-500/25 transition group-hover:rotate-6">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        © {new Date().getFullYear()} Cognithan
      </footer>
    </main>
  );
}
