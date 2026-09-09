import { NextResponse } from "next/server";
import { Resend } from "resend";
import { bookingConfig } from "@/lib/booking-config";
import { createBooking, getBusyBlocks } from "@/lib/msgraph";
import { filterAvailable } from "@/lib/slots";
import { brand } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface BookBody {
  startUtc: string;
  endUtc: string;
  contactName: string;
  contactEmail: string;
  contactCompany?: string;
  notes?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function POST(req: Request) {
  let body: BookBody;
  try {
    body = (await req.json()) as BookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { startUtc, endUtc, contactName, contactEmail, contactCompany, notes } = body;
  if (!startUtc || !endUtc || !contactName?.trim() || !contactEmail?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!isValidEmail(contactEmail)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (contactName.length > 200 || (contactCompany?.length ?? 0) > 200 || (notes?.length ?? 0) > 2000) {
    return NextResponse.json({ error: "Input too long" }, { status: 400 });
  }

  const start = new Date(startUtc);
  const end = new Date(endUtc);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
  }
  const expectedMs = bookingConfig.slotMinutes * 60_000;
  if (end.getTime() - start.getTime() !== expectedMs) {
    return NextResponse.json({ error: "Slot length mismatch" }, { status: 400 });
  }

  const minNotice = new Date(Date.now() + bookingConfig.minNoticeHours * 3600_000);
  if (start < minNotice) {
    return NextResponse.json({ error: "Slot too soon" }, { status: 400 });
  }

  try {
    const busy = await getBusyBlocks(start, end);
    const free = filterAvailable([{ startUtc: start.toISOString(), endUtc: end.toISOString() }], busy);
    if (free.length === 0) {
      return NextResponse.json({ error: "Slot is no longer available" }, { status: 409 });
    }

    const created = await createBooking({
      startUtc: start,
      endUtc: end,
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactCompany: contactCompany?.trim() || undefined,
      notes: notes?.trim() || undefined,
      source: brand.domain,
    });

    const notifyTo = process.env.NOTIFICATION_EMAIL?.trim();
    if (resend && notifyTo) {
      const when = start.toLocaleString("en-US", {
        timeZone: bookingConfig.timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
      resend.emails
        .send({
          from: process.env.EMAIL_FROM ?? `${brand.name} <reports@${brand.domain}>`,
          to: [notifyTo],
          subject: `Walkthrough booked: ${contactName.slice(0, 60)} - ${when}`,
          html: `
            <p>New report walkthrough booked on ${esc(brand.domain)}.</p>
            <ul>
              <li><strong>${esc(contactName)}</strong> &lt;${esc(contactEmail)}&gt;${contactCompany ? ` - ${esc(contactCompany)}` : ""}</li>
              <li><strong>When:</strong> ${esc(when)}</li>
              ${created.joinUrl ? `<li><strong>Teams:</strong> <a href="${esc(created.joinUrl)}">${esc(created.joinUrl)}</a></li>` : ""}
              ${notes ? `<li><strong>Notes:</strong> ${esc(notes).replace(/\n/g, "<br/>")}</li>` : ""}
            </ul>
          `,
        })
        .catch((e) => console.error("notify email failed", e));
    }

    return NextResponse.json({
      ok: true,
      eventId: created.eventId,
      joinUrl: created.joinUrl,
    });
  } catch (err) {
    console.error("book error", err);
    return NextResponse.json({ error: "Booking failed" }, { status: 500 });
  }
}
