import Spinner from '@/components/ui/Spinner.jsx';
import { buttonClasses } from '@/components/ui/styles.js';

export default function Button({
  children,
  loading = false,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className={size === 'sm' ? 'size-3.5' : 'size-4'} />}
      {children}
    </button>
  );
}
