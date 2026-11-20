"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";

type Mode = "login" | "signup" | "forgot" | "update";

const COPY: Record<Mode, { title: string; sub: string; cta: string }> = {
  login: { title: "Welcome back", sub: "Sign in to pick up where you left off.", cta: "Sign in" },
  signup: { title: "Create your space", sub: "Free forever for your personal notes.", cta: "Create account" },
  forgot: { title: "Reset password", sub: "We'll email you a secure reset link.", cta: "Send reset link" },
  update: { title: "Choose a new password", sub: "Make it at least 8 characters.", cta: "Update password" },
};

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/notes";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const copy = COPY[mode];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const origin = window.location.origin;
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(safeNext(params.get("next")));
        router.refresh();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${origin}/auth/callback?next=/notes`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/notes");
          router.refresh();
        } else {
          setSent(true);
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/auth/callback?next=/update-password`,
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Password updated");
        router.replace("/notes");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="bg-gradient-brand mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg shadow-fuchsia-500/30">
          <MailCheck className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted">
          We sent a link to <span className="font-medium text-fg">{email}</span>. Open it on this
          device to continue.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  const authError = params.get("error");

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">{copy.title}</h1>
        <p className="mt-1.5 text-sm text-muted">{copy.sub}</p>
      </div>

      {authError && (
        <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
          That link is invalid or has expired. Please try again.
        </p>
      )}

      {mode === "signup" && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
        </label>
      )}

      {mode !== "update" && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
          />
        </label>
      )}

      {mode !== "forgot" && (
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between text-sm font-medium">
            Password
            {mode === "login" && (
              <Link href="/forgot-password" className="text-xs font-normal text-accent hover:underline">
                Forgot?
              </Link>
            )}
          </span>
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              required
              minLength={mode === "login" ? undefined : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-fg"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {copy.cta}
      </Button>

      <p className="pt-2 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
