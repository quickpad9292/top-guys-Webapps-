export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-violet-500/30 blur-[120px] animate-float dark:bg-violet-600/25" />
      <div className="absolute top-1/3 -right-40 h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/25 blur-[120px] animate-float [animation-delay:-5s] dark:bg-fuchsia-600/20" />
      <div className="absolute -bottom-40 left-1/3 h-[28rem] w-[28rem] rounded-full bg-orange-400/25 blur-[120px] animate-float [animation-delay:-9s] dark:bg-orange-500/15" />
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--fg) 14%, transparent) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
    </div>
  );
}
