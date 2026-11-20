/** Placeholder shape while data loads. */
export function Skeleton({ className = '' }) {
  return (
    <div aria-hidden="true" className={`animate-pulse rounded-md bg-zinc-800/80 ${className}`} />
  );
}

/** Wrapper that tells assistive technology content is loading. */
export function SkeletonGroup({ label = 'Loading', className = '', children }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className={className}>
      {children}
    </div>
  );
}

export default Skeleton;
