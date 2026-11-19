import Spinner from '@/components/Spinner.jsx';

export default function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center text-emerald-400" role="status">
      <Spinner className="size-8" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
