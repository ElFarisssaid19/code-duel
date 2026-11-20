import Button from '@/components/ui/Button.jsx';

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <Button variant="secondary" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        ← Previous
      </Button>
      <span className="text-zinc-400">
        Page <span className="font-mono text-zinc-200">{page}</span> of{' '}
        <span className="font-mono text-zinc-200">{totalPages}</span>
      </span>
      <Button variant="secondary" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
        Next →
      </Button>
    </nav>
  );
}
