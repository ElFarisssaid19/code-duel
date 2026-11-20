/** Form-level message banner. tone="info" for neutral notices. */
export default function FormError({ children, tone = 'danger' }) {
  if (!children) return null;
  const styles =
    tone === 'info'
      ? 'border-sky-500/40 bg-sky-500/10 text-sky-100'
      : tone === 'success'
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
        : 'border-red-500/40 bg-red-500/10 text-red-200';
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`rounded-lg border px-3.5 py-2.5 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}
