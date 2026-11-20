import Link from "next/link";
import { Backdrop } from "@/components/backdrop";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center px-4 py-10">
      <Backdrop />
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <Logo className="h-10 w-10" />
          <span className="font-display text-2xl font-bold tracking-tight">Cognithan</span>
        </Link>
        <div className="glass rounded-[2rem] p-7 sm:p-9">{children}</div>
      </div>
    </main>
  );
}
