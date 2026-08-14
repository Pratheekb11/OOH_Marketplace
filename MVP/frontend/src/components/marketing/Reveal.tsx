"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll-triggered entrance for landing-page blocks.
 *
 * Deliberately one-shot: the observer disconnects on first intersection, so
 * a block never re-animates when the reader scrolls back up. The transition
 * itself lives in globals.css (`.reveal` / `.is-in`) so that the
 * prefers-reduced-motion override can neutralise it in one place instead of
 * per component.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Already on screen at mount (above the fold) — skip the observer so the
    // block is never stuck invisible on browsers that fire late.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`reveal${shown ? " is-in" : ""}${className ? ` ${className}` : ""}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
