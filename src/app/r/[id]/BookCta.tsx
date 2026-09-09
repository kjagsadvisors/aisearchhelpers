"use client";

import { useEffect, useState } from "react";

// Two conversion surfaces on the report page:
// 1. A popup 25s into reading (closable after 5s), once per report per browser.
// 2. A sticky bottom bar that appears after real scroll and stays.
export function BookCta({
  bookingUrl,
  scanId,
  score,
  missed,
  total,
}: {
  bookingUrl: string;
  scanId: string;
  score: number;
  missed: number;
  total: number;
}) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [closeIn, setCloseIn] = useState(5);
  const [barVisible, setBarVisible] = useState(false);
  const storageKey = `aish-popup-${scanId}`;

  // popup after 25s of reading
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey) === "1";
    } catch {
      // storage unavailable; show at most once per pageview
    }
    if (seen) return;
    const t = setTimeout(() => setPopupOpen(true), 25_000);
    return () => clearTimeout(t);
  }, [storageKey]);

  // close button unlocks after 5s
  useEffect(() => {
    if (!popupOpen) return;
    setCloseIn(5);
    const iv = setInterval(() => {
      setCloseIn((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [popupOpen]);

  // sticky bar after meaningful scroll
  useEffect(() => {
    const onScroll = () => setBarVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function dismiss() {
    setPopupOpen(false);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // fine
    }
  }

  return (
    <>
      {/* sticky bottom bar */}
      {barVisible && !popupOpen && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#0a0a0f]/95 backdrop-blur px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <p className="text-sm text-white/70 min-w-0 truncate">
              Missing from {missed} of {total} AI answers.
            </p>
            <a
              href={bookingUrl}
              className="shrink-0 bg-[var(--accent)] text-black text-sm font-semibold rounded-lg px-4 py-2.5 hover:bg-[var(--accent-hover)] transition-colors"
            >
              Book a free walkthrough
            </a>
          </div>
        </div>
      )}

      {/* timed popup */}
      {popupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--accent-a30)] bg-[#101017] p-7 space-y-4 text-center">
            <button
              onClick={dismiss}
              disabled={closeIn > 0}
              aria-label="Close"
              className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${
                closeIn > 0
                  ? "text-white/20 cursor-default"
                  : "text-white/50 hover:text-white hover:bg-white/10"
              }`}
            >
              {closeIn > 0 ? closeIn : "✕"}
            </button>
            <p className="text-5xl font-extrabold text-red-400">
              {score}
              <span className="text-lg text-white/30">/100</span>
            </p>
            <h3 className="text-xl font-bold leading-snug">
              Your competitors are getting recommended. You're not.
            </h3>
            <p className="text-sm text-white/55">
              Grab a time and we'll go over your report and what to fix first. Free, on Teams.
            </p>
            <a
              href={bookingUrl}
              className="block bg-[var(--accent)] text-black font-semibold rounded-xl px-6 py-3.5 hover:bg-[var(--accent-hover)] transition-colors"
            >
              Pick a time
            </a>
          </div>
        </div>
      )}
    </>
  );
}
