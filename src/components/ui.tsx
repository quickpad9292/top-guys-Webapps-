"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "soft";
  size?: "sm" | "md" | "lg" | "icon";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 select-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
        variant === "primary" &&
          "bg-gradient-brand text-white shadow-[0_8px_24px_-8px_rgba(219,39,119,0.6)] hover:shadow-[0_10px_30px_-6px_rgba(124,58,237,0.7)] hover:brightness-110",
        variant === "ghost" && "text-fg/80 hover:bg-fg/[0.06] hover:text-fg",
        variant === "outline" && "border border-line-strong bg-solid/60 hover:bg-fg/[0.04]",
        variant === "soft" && "bg-accent/12 text-accent hover:bg-accent/20",
        variant === "danger" && "bg-rose-500/12 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        size === "icon" && "h-9 w-9",
        className,
      )}
      {...props}
    />
  );
});

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-line-strong bg-solid/70 px-3.5 text-sm text-fg transition placeholder:text-muted/70 focus:border-accent/60 focus:ring-4 focus:ring-accent/15 focus:outline-none",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong bg-solid px-1 font-mono text-[10px] font-medium text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-8 w-8", className)} aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.55" stopColor="#db2777" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#lg)" />
      <path
        d="M26.5 13.2a9 9 0 1 0 0 13.6"
        fill="none"
        stroke="white"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <circle cx="27.5" cy="20" r="2.6" fill="white" />
    </svg>
  );
}

export function Modal({
  open,
  onClose,
  children,
  className,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm animate-in fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal
      aria-label={title}
    >
      <div className={cn("glass w-full max-w-lg rounded-3xl !bg-solid/95 p-6", className)}>
        {title && <h2 className="mb-4 font-display text-xl font-semibold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
