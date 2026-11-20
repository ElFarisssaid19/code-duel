import { Link } from 'react-router';

/** 404: unknown routes, users and matches. */
export default function NotFoundPage({
  title = 'Page not found',
  message = "The page you're looking for doesn't exist.",
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="font-mono text-6xl font-bold text-zinc-700">404</p>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-zinc-400">{message}</p>
      <Link to="/" className="text-sm font-medium text-emerald-400 hover:text-emerald-300">
        ← Back home
      </Link>
    </main>
  );
}
