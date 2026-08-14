"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The landing page's signature element: a play-out loop.
 *
 * Digital OOH is sold as a rotation — your creative holds the screen for a
 * fixed slot, then the next advertiser's does. The hero card behaves the same
 * way, so the first thing a visitor sees is the medium the site sells rather
 * than a generic carousel. Segments are buttons: clicking one takes over the
 * loop, which is also how it stays keyboard-reachable.
 *
 * Under prefers-reduced-motion the rotation never auto-advances and the fill
 * bar is not animated; the segments still work as manual tabs.
 */
const SLOT_MS = 6000;

const SLOTS = [
  {
    tag: "Rates",
    headline: "Every rate is on the listing.",
    body: "₹400 to ₹1.3 lakh per day, published up front. No request-for-quote, no callback, no rate card over email.",
  },
  {
    tag: "Availability",
    headline: "Dates you can actually take.",
    body: "Availability is live. Choose your run, pay online, and the site is held for those dates.",
  },
  {
    tag: "Fulfilment",
    headline: "Print and install are included.",
    body: "Large-format print, certified riggers, permits handled — then dated photos of your creative on site.",
  },
];

export default function HeroSlots() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current || paused) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % SLOTS.length), SLOT_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const slot = SLOTS[index];

  return (
    <div
      className="slot-card w-full max-w-sm border border-white/15 bg-black/45 p-6 backdrop-blur-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="mb-5 flex items-center justify-between font-inter text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_2px_rgba(254,166,25,0.7)]" />
          Now playing
        </span>
        <span className="tabular-nums">{slot.tag}</span>
      </div>

      {/* aria-live keeps screen readers informed as the loop advances without
          moving focus. */}
      <div aria-live="polite" className="min-h-[7.5rem]">
        <p key={`h-${index}`} className="slot-in font-syne text-xl font-bold leading-tight text-white">
          {slot.headline}
        </p>
        <p key={`b-${index}`} className="slot-in mt-2.5 text-[13px] font-light leading-relaxed text-white/65">
          {slot.body}
        </p>
      </div>

      <div className="mt-5 flex gap-2">
        {SLOTS.map((s, i) => (
          <button
            key={s.tag}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show slot ${i + 1}: ${s.tag}`}
            aria-current={i === index}
            className="group h-6 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="block h-[3px] w-full bg-white/15">
              <span
                key={i === index ? `fill-${index}` : `idle-${i}`}
                className={
                  i === index
                    ? "slot-fill block h-full bg-accent"
                    : "block h-full w-0 bg-accent transition-[width] duration-300 group-hover:w-full group-hover:bg-white/40"
                }
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
