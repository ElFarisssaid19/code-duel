import { Link } from 'react-router';
import Logo from '@/components/Logo.jsx';
import MockDuel from '@/components/landing/MockDuel.jsx';
import PublicStats from '@/components/landing/PublicStats.jsx';
import { buttonClasses } from '@/components/ui/styles.js';
import { AUTHOR, REPO_URL } from '@/lib/site.js';

const FEATURES = [
  {
    icon: '♛',
    title: 'Ranked ELO',
    text: 'Matchmaking pairs you with players of your level. Every ranked win or loss moves your rating.',
  },
  {
    icon: '⇄',
    title: 'Private rooms',
    text: 'Create a room, share a 6-letter code or an invite link, and duel a friend. Unranked, no ELO at stake.',
  },
  {
    icon: '{ }',
    title: 'JavaScript & Python',
    text: 'Pick your language, switch any time. A real editor with syntax highlighting and shortcuts.',
  },
  {
    icon: '▣',
    title: 'Sandboxed execution',
    text: 'Code runs in an isolated go-judge sandbox with CPU, memory and network limits. Hidden tests stay hidden.',
  },
  {
    icon: '◉',
    title: 'Live opponent progress',
    text: "See your rival's tests passed, attempts and typing in real time. Know exactly when to push.",
  },
];

const STEPS = [
  { title: 'Pick a mode', text: 'Play ranked to climb, or open a private room for a friend.' },
  {
    title: 'Solve the same problem',
    text: 'Both players get the same problem and the same clock. Run samples, then submit.',
  },
  {
    title: 'Win and climb',
    text: 'Pass every test first to win. Your ELO, stats and history update instantly.',
  },
];

function SectionTitle({ eyebrow, title, id }) {
  return (
    <div className="mb-8 space-y-2 text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h2>
    </div>
  );
}

/** Public home page for logged-out visitors. */
export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link to="/" className="rounded-md" aria-label="Code Duel home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2" aria-label="Account">
          <Link to="/login" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
            Log in
          </Link>
          <Link to="/register" className={buttonClasses({ size: 'sm' })}>
            Register
          </Link>
        </nav>
      </header>

      <main id="main" className="flex-1">
        <section
          className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 pb-16 sm:pt-14 lg:grid-cols-[1fr_1.05fr] lg:gap-14"
          aria-labelledby="hero-title"
        >
          <div className="space-y-6 text-center lg:text-left">
            <p className="eyebrow">Real-time 1v1 coding battles</p>
            <h1
              id="hero-title"
              className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl"
            >
              Same problem.
              <br />
              Same clock.
              <br />
              <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">
                One winner.
              </span>
            </h1>
            <p className="mx-auto max-w-lg text-base text-ink-muted sm:text-lg lg:mx-0">
              Code Duel drops you and a rival into the same algorithm problem. Write, run and submit
              in JavaScript or Python. First to pass every hidden test takes the win and the ELO.
            </p>
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link
                to="/register"
                className={buttonClasses({
                  size: 'lg',
                  className: 'font-display tracking-wide uppercase',
                })}
              >
                Start dueling, it&apos;s free
              </Link>
              <Link to="/login" className={buttonClasses({ size: 'lg', variant: 'secondary' })}>
                Log in
              </Link>
            </div>
            <p className="text-xs text-ink-subtle">
              16 problems · JavaScript & Python · sandboxed by go-judge
            </p>
          </div>
          <MockDuel />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="features-title">
          <SectionTitle
            eyebrow="Features"
            title="Built for competitive coding"
            id="features-title"
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="group rounded-2xl border border-line bg-surface/70 p-5 shadow-card transition hover:-translate-y-0.5 hover:border-emerald-500/30"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-lg border border-line-strong bg-surface-raised font-display text-accent transition group-hover:shadow-glow"
                >
                  {f.icon}
                </span>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-ink-muted">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16" aria-labelledby="how-title">
          <SectionTitle
            eyebrow="How it works"
            title="Three steps to your first win"
            id="how-title"
          />
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="relative rounded-2xl border border-line bg-surface/70 p-6 shadow-card"
              >
                <span className="font-mono text-5xl font-bold text-zinc-700" aria-hidden="true">
                  0{i + 1}
                </span>
                <h3 className="mt-2 text-lg font-semibold">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm text-ink-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16" aria-labelledby="stats-title">
          <SectionTitle eyebrow="Live" title="The arena right now" id="stats-title" />
          <PublicStats />
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 text-center" aria-labelledby="cta-title">
          <h2 id="cta-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready for your first duel?
          </h2>
          <p className="mt-3 text-ink-muted">
            Create an account in ten seconds. Your first opponent is waiting.
          </p>
          <Link
            to="/register"
            className={buttonClasses({
              size: 'lg',
              className: 'mt-6 font-display tracking-wide uppercase',
            })}
          >
            Create an account
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-ink-muted sm:flex-row">
          <Logo className="text-sm" />
          <p>
            Built by <span className="text-ink">{AUTHOR}</span>
          </p>
          <a
            href={REPO_URL}
            className="inline-flex items-center gap-2 rounded hover:text-ink"
            target="_blank"
            rel="noreferrer"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
