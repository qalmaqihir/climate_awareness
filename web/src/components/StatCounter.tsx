'use client';

import { useEffect, useRef, useState } from 'react';

interface StatCounterProps {
  value: number;
  label: string;
  suffix?: string;
}

export function StatCounter({ value, label, suffix = '' }: StatCounterProps) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const duration = 1200;

  useEffect(() => {
    if (value === 0) return;
    startRef.current = performance.now();

    function tick(now: number) {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return (
    <div className="text-center">
      <p className="font-mono text-5xl font-bold tabular-nums text-slate-900 sm:text-6xl">
        {display.toLocaleString()}
        {suffix}
      </p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
    </div>
  );
}
