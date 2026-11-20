import { fieldClasses } from '@/components/ui/styles.js';

/** Text input with the shared field style. `invalid` turns it red (pair with aria-describedby). */
export default function Input({ invalid = false, className = '', ...props }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={fieldClasses(invalid, className)}
      {...props}
    />
  );
}
