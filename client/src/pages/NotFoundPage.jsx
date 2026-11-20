import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/styles.js';

/** 404: unknown routes, users and matches. */
export default function NotFoundPage({
  title = 'Page not found',
  message = "The page you're looking for doesn't exist.",
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="font-mono text-7xl font-bold text-zinc-700" aria-hidden="true">
        404
      </p>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-ink-muted">{message}</p>
      <Link to="/" className={buttonClasses({ variant: 'secondary', className: 'mt-2' })}>
        ← Back home
      </Link>
    </main>
  );
}
