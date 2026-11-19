/** Form-level error banner (errors that aren't about a specific field). */
export default function FormError({ children }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
    >
      {children}
    </div>
  );
}
