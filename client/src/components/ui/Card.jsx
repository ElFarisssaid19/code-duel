/** Surface container. `glow` highlights it with the accent (e.g. the winner). */
export default function Card({
  as: Tag = 'div',
  className = '',
  padding = 'p-5 sm:p-6',
  glow,
  children,
  ...props
}) {
  const ring =
    glow === 'accent'
      ? 'border-emerald-500/40 shadow-glow'
      : glow === 'rival'
        ? 'border-sky-500/40 shadow-glow-rival'
        : 'border-line shadow-card';
  return (
    <Tag
      className={`rounded-2xl border bg-surface/80 backdrop-blur-sm ${ring} ${padding} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
