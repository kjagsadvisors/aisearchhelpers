"use client";

import { useEffect, useMemo, useState } from "react";

interface Slot {
  startUtc: string;
  endUtc: string;
}

interface AvailabilityResponse {
  timezone: string;
  slotMinutes: number;
  slots: Slot[];
}

type Status = "loading" | "idle" | "submitting" | "success" | "error";

function fmtDay(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(d);
}
function fmtDayKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function fmtTime(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

const inputCls =
  "w-full bg-white/5 border border-white/15 focus:border-[var(--accent-a60)] rounded-xl px-4 py-3 text-sm outline-none transition-colors placeholder:text-white/25";

export interface BookingPrefill {
  name: string;
  email: string;
  company: string;
}

export default function BookingWidget({ prefill }: { prefill?: BookingPrefill | null }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState(prefill?.name ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [company, setCompany] = useState(prefill?.company ?? "");
  const [editIdentity, setEditIdentity] = useState(false);
  const known = Boolean(prefill?.email) && !editIdentity;
  const [confirmation, setConfirmation] = useState<{ joinUrl?: string; whenLabel: string } | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/availability", { cache: "no-store" });
        if (!res.ok) throw new Error("Could not load times");
        const json = (await res.json()) as AvailabilityResponse;
        if (cancel) return;
        setData(json);
        setStatus("idle");
        if (json.slots[0]) setSelectedDayKey(fmtDayKey(new Date(json.slots[0].startUtc), json.timezone));
      } catch {
        if (cancel) return;
        setStatus("error");
        setError("Couldn't load available times. Try refreshing.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const dayList = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const days: { key: string; label: string }[] = [];
    for (const s of data.slots) {
      const d = new Date(s.startUtc);
      const k = fmtDayKey(d, data.timezone);
      if (seen.has(k)) continue;
      seen.add(k);
      days.push({ key: k, label: fmtDay(d, data.timezone) });
    }
    return days;
  }, [data]);

  const slotsForDay = useMemo(() => {
    if (!data || !selectedDayKey) return [];
    return data.slots.filter((s) => fmtDayKey(new Date(s.startUtc), data.timezone) === selectedDayKey);
  }, [data, selectedDayKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !data) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUtc: selectedSlot.startUtc,
          endUtc: selectedSlot.endUtc,
          contactName: name,
          contactEmail: email,
          contactCompany: company,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Booking failed");
      const startDate = new Date(selectedSlot.startUtc);
      const tzName =
        new Intl.DateTimeFormat("en", { timeZone: data.timezone, timeZoneName: "short" })
          .formatToParts(startDate)
          .find((p) => p.type === "timeZoneName")?.value || "";
      setConfirmation({
        joinUrl: json.joinUrl,
        whenLabel: `${fmtDay(startDate, data.timezone)} at ${fmtTime(startDate, data.timezone)} ${tzName}`,
      });
      setStatus("success");
    } catch (err) {
      setStatus("idle");
      setError((err as Error).message);
    }
  }

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/50">
        Loading available times…
      </div>
    );
  }

  if (status === "success" && confirmation) {
    return (
      <div className="rounded-2xl border border-[var(--accent-a30)] bg-[var(--accent-a06)] p-8 text-center space-y-3">
        <p className="text-xs uppercase tracking-widest text-[var(--accent-hover)]">Booked</p>
        <h3 className="text-2xl font-bold">See you {confirmation.whenLabel}.</h3>
        <p className="text-white/60 text-sm">
          A calendar invite with the Microsoft Teams link is on its way to {email}.
        </p>
        {confirmation.joinUrl && (
          <a
            href={confirmation.joinUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block bg-[var(--accent)] text-black font-semibold rounded-xl px-6 py-3 hover:bg-[var(--accent-hover)] transition-colors"
          >
            Open Teams link
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {dayList.length === 0 ? (
        <p className="text-white/50">No times available right now. Check back tomorrow.</p>
      ) : (
        <>
          <div>
            <p className="text-xs text-white/40 mb-2">Pick a day</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {dayList.map((d) => {
                const active = d.key === selectedDayKey;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => {
                      setSelectedDayKey(d.key);
                      setSelectedSlot(null);
                    }}
                    className={`shrink-0 rounded-lg px-3.5 py-2 text-sm border transition-colors ${
                      active
                        ? "bg-[var(--accent)] text-black border-transparent font-semibold"
                        : "border-white/15 text-white/70 hover:border-white/35"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs text-white/40 mb-2">Pick a time ({data?.slotMinutes} min)</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slotsForDay.map((s) => {
                const active = selectedSlot?.startUtc === s.startUtc;
                return (
                  <button
                    key={s.startUtc}
                    type="button"
                    onClick={() => setSelectedSlot(s)}
                    className={`rounded-lg px-2 py-2 text-sm border transition-colors ${
                      active
                        ? "bg-[var(--accent)] text-black border-transparent font-semibold"
                        : "border-white/15 text-white/70 hover:border-white/35"
                    }`}
                  >
                    {data ? fmtTime(new Date(s.startUtc), data.timezone) : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {known ? (
            <p className="text-xs text-white/40">
              Booking as <span className="text-white/75">{name || email}</span> · {email}
              {" "}
              <button
                type="button"
                onClick={() => setEditIdentity(true)}
                className="underline hover:text-white/70"
              >
                Not you?
              </button>
            </p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  autoComplete="name"
                  className={inputCls}
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  type="email"
                  required
                  autoComplete="email"
                  className={inputCls}
                />
              </div>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Business name (optional)"
                autoComplete="organization"
                className={inputCls}
              />
            </>
          )}

          <button
            type="submit"
            disabled={!selectedSlot || status === "submitting"}
            className="w-full bg-[var(--accent)] text-black font-semibold rounded-xl px-6 py-3.5 hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40"
          >
            {status === "submitting" ? "Booking…" : "Book my walkthrough"}
          </button>
        </>
      )}
    </form>
  );
}
