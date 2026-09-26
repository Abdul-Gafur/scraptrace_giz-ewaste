export function SkipLink({ children }: { children: string }) {
  return (
    <a
      className="fixed start-4 top-3 z-50 -translate-y-24 rounded-md bg-[var(--primary)] px-4 py-3 font-semibold text-white transition-transform focus:translate-y-0"
      href="#main-content"
    >
      {children}
    </a>
  );
}
