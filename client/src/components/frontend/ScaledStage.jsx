import { useEffect, useRef, useState } from 'react';

/**
 * Lays out children on a canvas of exactly width × height px, scaled down (never up) to fit the
 * available width. Children are positioned in canvas pixels (absolute, inset-0).
 */
export default function ScaledStage({ width, height, className = '', children, label }) {
  const outer = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={outer} className={`w-full ${className}`}>
      <div
        className="relative mx-auto overflow-hidden rounded-md ring-1 ring-line-strong"
        style={{ width: width * scale, height: height * scale }}
        role={label ? 'group' : undefined}
        aria-label={label}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width, height, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
