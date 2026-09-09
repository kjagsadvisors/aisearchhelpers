"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Step = "url" | "email" | "name" | "phone" | "qualifier" | "progress" | "done";

const QUALIFIERS = [
  "Under $10k / month",
  "$10k – $50k / month",
  "$50k – $200k / month",
  "$200k+ / month",
  "Prefer not to say",
];

const STAGES = [
  { at: 5, label: "Reading your website" },
  { at: 15, label: "Understanding your business" },
  { at: 22, label: "Finding what your customers actually search" },
  { at: 30, label: "Asking AI assistants your customers' buying questions" },
  { at: 70, label: "Checking your web presence and citations" },
  { at: 85, label: "Scoring and writing your report" },
];

const inputCls =
  "w-full bg-white/5 border border-white/15 focus:border-emerald-400/60 rounded-xl px-5 py-4 text-lg outline-none transition-colors placeholder:text-white/25";

export default function Funnel() {
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [scanId, setScanId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [serverStep, setServerStep] = useState("Queued");
  const [scanDone, setScanDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const bookingUrl = process.env.NEXT_PUBLIC_BOOKING_URL;

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  // Poll scan status once we have a scanId, regardless of which form step the user is on.
  useEffect(() => {
    if (!scanId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan/${scanId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { status: string; step: string; progress: number };
        setProgress(data.progress);
        setServerStep(data.step);
        if (data.status === "done") {
          setScanDone(true);
          clearInterval(interval);
        }
        if (data.status === "error") {
          setError("The scan hit a snag on your site. We'll re-run it and email your report.");
          clearInterval(interval);
        }
      } catch {
        // transient network error — keep polling
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [scanId]);

  // If the scan finishes while the user is on the progress screen, advance.
  useEffect(() => {
    if (step === "progress" && scanDone) setStep("done");
  }, [step, scanDone]);

  const patchLead = useCallback(
    (fields: Record<string, unknown>) => {
      if (!scanId) return;
      fetch(`/api/scan/${scanId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fields),
      }).catch(() => {});
    },
    [scanId]
  );

  async function submitEmail() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong — try again.");
        return;
      }
      setScanId(data.scanId);
      setStep("name");
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    setError(null);
    if (step === "url") {
      if (!url.trim()) return setError("Enter your website to get started.");
      setStep("email");
    } else if (step === "email") {
      if (!email.trim()) return setError("We need an email to send your report to.");
      void submitEmail();
    } else if (step === "name") {
      if (!firstName.trim()) return setError("What should we call you?");
      patchLead({ first_name: firstName, last_name: lastName });
      setStep("phone");
    } else if (step === "phone") {
      if (phone.trim()) patchLead({ phone });
      setStep("qualifier");
    }
  }

  function pickQualifier(q: string) {
    patchLead({ qualifier: q });
    setStep(scanDone ? "done" : "progress");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !busy) advance();
  }

  const stepIndex =
    step === "url" ? 1 : step === "email" ? 2 : step === "name" ? 3 : step === "phone" ? 4 : step === "qualifier" ? 5 : 0;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between max-w-3xl mx-auto w-full">
        <span className="font-bold tracking-tight text-lg">
          AI Search <span className="text-emerald-400">Helpers</span>
        </span>
        {stepIndex > 0 && <span className="text-sm text-white/40">{stepIndex} / 5</span>}
      </header>

      <div className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-xl">
          {step === "url" && (
            <StepShell
              title="Is your business invisible in ChatGPT?"
              subtitle="Enter your website. We'll ask AI assistants the questions your customers ask — and show you who they recommend instead of you."
            >
              <input
                ref={inputRef}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="yourwebsite.com"
                autoComplete="url"
                inputMode="url"
                className={inputCls}
              />
              <Continue onClick={advance} label="Analyze my site" />
            </StepShell>
          )}

          {step === "email" && (
            <StepShell
              title="Where should we send your report?"
              subtitle={`We're queuing up the scan for ${url.replace(/^https?:\/\//, "")}.`}
            >
              <input
                ref={inputRef}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="you@company.com"
                type="email"
                autoComplete="email"
                className={inputCls}
              />
              <Continue onClick={advance} label={busy ? "Starting scan…" : "Start my scan"} disabled={busy} />
            </StepShell>
          )}

          {step === "name" && (
            <StepShell title="Scan started. Who's this report for?" subtitle="We're reading your site right now.">
              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="First name"
                  autoComplete="given-name"
                  className={inputCls}
                />
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Last name"
                  autoComplete="family-name"
                  className={inputCls}
                />
              </div>
              <MiniProgress progress={progress} label={serverStep} />
              <Continue onClick={advance} label="Continue" />
            </StepShell>
          )}

          {step === "phone" && (
            <StepShell
              title="Best number to reach you?"
              subtitle="If your report turns up something urgent, a real person will text or call you about it. No spam, no automated blasts."
            >
              <input
                ref={inputRef}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="(555) 123-4567"
                type="tel"
                autoComplete="tel"
                className={inputCls}
              />
              <MiniProgress progress={progress} label={serverStep} />
              <div className="flex gap-3 items-center">
                <Continue onClick={advance} label="Continue" />
                <button onClick={() => setStep("qualifier")} className="text-white/40 text-sm hover:text-white/70">
                  Skip
                </button>
              </div>
            </StepShell>
          )}

          {step === "qualifier" && (
            <StepShell
              title="Last one — roughly what's your monthly revenue?"
              subtitle="This tunes the recommendations in your report."
            >
              <div className="flex flex-col gap-2">
                {QUALIFIERS.map((q) => (
                  <button
                    key={q}
                    onClick={() => pickQualifier(q)}
                    className="text-left px-5 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-emerald-400/10 hover:border-emerald-400/40 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <MiniProgress progress={progress} label={serverStep} />
            </StepShell>
          )}

          {step === "progress" && (
            <StepShell title="Building your report" subtitle="This usually takes about a minute. Don't close the tab.">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(progress, 4)}%` }}
                />
              </div>
              <ul className="space-y-3 mt-6">
                {STAGES.map((s) => (
                  <li key={s.at} className="flex items-center gap-3 text-sm">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                        progress > s.at
                          ? "bg-emerald-400 text-black"
                          : progress >= s.at
                            ? "bg-emerald-400/30 text-emerald-300 animate-pulse"
                            : "bg-white/10 text-white/30"
                      }`}
                    >
                      {progress > s.at ? "✓" : ""}
                    </span>
                    <span className={progress >= s.at ? "text-white" : "text-white/40"}>{s.label}</span>
                  </li>
                ))}
              </ul>
            </StepShell>
          )}

          {step === "done" && scanId && (
            <StepShell title="Your report is ready." subtitle="We also emailed you a copy so you can find it later.">
              <a
                href={`/r/${scanId}`}
                className="block text-center bg-emerald-400 text-black font-semibold rounded-xl px-6 py-4 hover:bg-emerald-300 transition-colors"
              >
                View my AI Search Report →
              </a>
              {bookingUrl && (
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center border border-white/20 rounded-xl px-6 py-4 hover:bg-white/5 transition-colors"
                >
                  Want us to walk you through your top 3 fixes? Book 15 minutes — free
                </a>
              )}
            </StepShell>
          )}

          {error && step !== "done" && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </div>
      </div>

      <footer className="px-6 py-4 text-center text-xs text-white/25">
        aisearchhelpers.com · One free scan per business · We never sell your info
      </footer>
    </main>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">{title}</h1>
        <p className="mt-3 text-white/50 text-base sm:text-lg">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Continue({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="bg-emerald-400 text-black font-semibold rounded-xl px-8 py-3.5 hover:bg-emerald-300 transition-colors disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function MiniProgress({ progress, label }: { progress: number; label: string }) {
  if (progress <= 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-emerald-400/70 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-white/35">{label}…</p>
    </div>
  );
}
