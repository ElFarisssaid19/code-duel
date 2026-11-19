/** Centered card used by the login and register pages. */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-2xl font-bold tracking-tight">
            Code <span className="text-emerald-400">Duel</span>
          </p>
          <h1 className="text-lg font-semibold text-zinc-100">{title}</h1>
          {subtitle && <p className="text-sm text-zinc-400">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/30">
          {children}
        </div>
        {footer && <p className="text-center text-sm text-zinc-400">{footer}</p>}
      </div>
    </main>
  );
}
