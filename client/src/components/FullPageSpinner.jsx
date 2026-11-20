import Spinner from '@/components/ui/Spinner.jsx';

export default function FullPageSpinner() {
  return (
    <div
      className="flex min-h-[60dvh] flex-1 items-center justify-center text-accent"
      role="status"
    >
      <Spinner className="size-8" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
