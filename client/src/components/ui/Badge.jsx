import { BADGE_TONES } from '@/components/ui/styles.js';

/** Small status pill. */
export default function Badge({ tone = 'neutral', className = '', children, ...props }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${BADGE_TONES[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
