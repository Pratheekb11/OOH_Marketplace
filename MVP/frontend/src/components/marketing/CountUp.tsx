"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts a single number up once, when it first scrolls into view.
 *
 * Deliberately one-shot, like Reveal: the observer disconnects on first
 * intersection so the figure never re-runs when the reader scrolls back. Under
 * prefers-reduced-motion it renders the final value immediately and never
 * animates — the value is information, so it must be legible either way, which
 * is also why the element carries the final number in aria-label.
 */
export default function CountUp({
  to,
  suffix = "",
  durationMs = 1400,
}: {
  to: number;
  suffix?: string;
  durationMs?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }

    let frame = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / durationMs, 1);
        // Same ease-out curve as the Reveal transition, so the figure settles
        // on the beat the surrounding block does.
        setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    // Already on screen at mount: start straight away rather than waiting for
    // a scroll that may never come.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      run();
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to, durationMs]);

  return (
    <span ref={ref} aria-label={`${to}${suffix}`} className="tabular-nums">
      {value}
      {suffix}
    </span>
  );
}
