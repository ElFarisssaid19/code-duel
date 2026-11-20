import Logo from '@/components/Logo.jsx';

/**
 * Dev-only 1200×630 layout, screenshotted by `npm run docs:capture` into
 * client/public/og-image.png (Open Graph / Twitter card).
 */
export default function OgImagePage() {
  return (
    <div
      className="relative flex h-[630px] w-[1200px] flex-col justify-between overflow-hidden bg-canvas p-16"
      style={{
        backgroundImage:
          'radial-gradient(40rem 24rem at 0% 0%, rgb(52 234 162 / 0.16), transparent 70%), radial-gradient(40rem 24rem at 100% 100%, rgb(82 188 255 / 0.14), transparent 70%)',
      }}
    >
      <Logo className="text-4xl" />
      <div className="space-y-6">
        <h1 className="text-7xl leading-[1.02] font-bold tracking-tight">
          Same problem. Same clock.
          <br />
          <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">
            One winner.
          </span>
        </h1>
        <p className="max-w-3xl text-2xl text-ink-muted">
          Real-time 1v1 coding battles with ranked ELO, private rooms and sandboxed JavaScript &
          Python.
        </p>
      </div>
      <div className="flex items-center gap-4 font-mono text-xl">
        <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-emerald-300">
          you 9/9
        </span>
        <span className="font-display text-2xl font-bold text-ink-subtle">VS</span>
        <span className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sky-300">
          rival 5/9
        </span>
        <span className="ml-auto font-display text-2xl font-bold tracking-wide text-emerald-300 uppercase">
          Victory · +16 ELO
        </span>
      </div>
    </div>
  );
}
