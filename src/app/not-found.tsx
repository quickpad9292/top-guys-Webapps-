import Link from "next/link";
import { Backdrop } from "@/components/backdrop";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <Backdrop />
      <div>
        <p className="text-gradient font-display text-8xl font-extrabold">404</p>
        <p className="mt-2 font-display text-2xl font-bold">This page wandered off.</p>
        <p className="mt-1 text-muted">The link may be private, revoked, or mistyped.</p>
        <Link href="/" className="bg-gradient-brand mt-6 inline-block rounded-xl px-5 py-2.5 font-semibold text-white">
          Go home
        </Link>
      </div>
    </main>
  );
}
