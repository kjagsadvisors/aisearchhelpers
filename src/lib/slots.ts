import { bookingConfig } from "./booking-config";
import type { BusyBlock } from "./msgraph";

export interface Slot {
  startUtc: string;
  endUtc: string;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    });
    partsCache.set(tz, f);
  }
  return f;
}

function getZonedParts(date: Date, tz: string) {
  const parts = fmt(tz).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour === "24" ? "0" : map.hour, 10),
    minute: parseInt(map.minute, 10),
    weekday: map.weekday,
  };
}

function zonedDateToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMin = getTzOffsetMinutes(new Date(guess), tz);
  return new Date(guess - offsetMin * 60_000);
}

function getTzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  const asUtc = Date.UTC(
    parseInt(m.year, 10),
    parseInt(m.month, 10) - 1,
    parseInt(m.day, 10),
    parseInt(m.hour === "24" ? "0" : m.hour, 10),
    parseInt(m.minute, 10),
    parseInt(m.second, 10)
  );
  return (asUtc - date.getTime()) / 60_000;
}

export function generateCandidateSlots(now: Date): Slot[] {
  const { timezone, businessStartHour, businessEndHour, slotMinutes, minNoticeHours, maxDaysAhead, weekdaysOnly } =
    bookingConfig;
  const out: Slot[] = [];
  const earliest = new Date(now.getTime() + minNoticeHours * 3600_000);
  const horizon = new Date(now.getTime() + maxDaysAhead * 86400_000);

  const startParts = getZonedParts(now, timezone);
  for (let dOffset = 0; dOffset <= maxDaysAhead; dOffset++) {
    const dayDate = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day + dOffset));
    const dayParts = getZonedParts(dayDate, timezone);
    if (weekdaysOnly && (dayParts.weekday === "Sat" || dayParts.weekday === "Sun")) continue;

    for (let h = businessStartHour; h < businessEndHour; h++) {
      for (let m = 0; m < 60; m += slotMinutes) {
        const startUtc = zonedDateToUtc(dayParts.year, dayParts.month, dayParts.day, h, m, timezone);
        const endUtc = new Date(startUtc.getTime() + slotMinutes * 60_000);
        if (startUtc < earliest) continue;
        if (endUtc > horizon) continue;
        out.push({ startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString() });
      }
    }
  }
  return out;
}

export function filterAvailable(candidates: Slot[], busy: BusyBlock[]): Slot[] {
  const { bufferMinutes } = bookingConfig;
  const buffer = bufferMinutes * 60_000;
  return candidates.filter((slot) => {
    const sStart = new Date(slot.startUtc).getTime();
    const sEnd = new Date(slot.endUtc).getTime();
    for (const b of busy) {
      const bStart = b.start.getTime() - buffer;
      const bEnd = b.end.getTime() + buffer;
      if (sStart < bEnd && sEnd > bStart) return false;
    }
    return true;
  });
}
