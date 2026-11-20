import { Link } from 'react-router';
import Logo from '@/components/Logo.jsx';
import Card from '@/components/ui/Card.jsx';

/** Centered card used by the login and register pages. */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8 motion-safe:animate-fade-up">
        <div className="space-y-2 text-center">
          <Link to="/" className="inline-block" aria-label="Code Duel home">
            <Logo className="text-2xl" />
          </Link>
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
          {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
        </div>
        <Card>{children}</Card>
        {footer && <p className="text-center text-sm text-ink-muted">{footer}</p>}
      </div>
    </main>
  );
}
