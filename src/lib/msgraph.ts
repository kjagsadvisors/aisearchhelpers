import { bookingConfig } from "./booking-config";

const TENANT = process.env.MS_TENANT_ID!;
const CLIENT_ID = process.env.MS_CLIENT_ID!;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET!;
const OWNER = bookingConfig.ownerEmail;

let cachedToken: { value: string; expiresAt: number } | null = null;

async function fetchFreshToken(): Promise<{ value: string; expiresAt: number }> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`Token fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  // Cap cache at 5 min — Microsoft's stated expires_in (3600s) can outlive
  // the actual usable lifetime under conditional access policies.
  const safeTtlMs = Math.min((data.expires_in || 3600) * 1000, 5 * 60_000);
  return { value: data.access_token, expiresAt: Date.now() + safeTtlMs };
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  cachedToken = await fetchFreshToken();
  return cachedToken.value;
}

async function graph<T = unknown>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (res.status === 401 && !retried) {
    cachedToken = null;
    return graph<T>(path, init, true);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph ${path} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

export interface BusyBlock {
  start: Date;
  end: Date;
}

export async function getBusyBlocks(rangeStart: Date, rangeEnd: Date): Promise<BusyBlock[]> {
  const body = {
    schedules: [OWNER],
    startTime: { dateTime: rangeStart.toISOString(), timeZone: "UTC" },
    endTime: { dateTime: rangeEnd.toISOString(), timeZone: "UTC" },
    availabilityViewInterval: 30,
  };
  const data = await graph<{
    value: Array<{ scheduleItems: Array<{ start: { dateTime: string }; end: { dateTime: string }; status: string }> }>;
  }>(`/users/${encodeURIComponent(OWNER)}/calendar/getSchedule`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const items = data.value?.[0]?.scheduleItems || [];
  return items
    .filter((i) => i.status !== "free")
    .map((i) => ({
      start: new Date(i.start.dateTime + "Z"),
      end: new Date(i.end.dateTime + "Z"),
    }));
}

export interface CreateBookingInput {
  startUtc: Date;
  endUtc: Date;
  contactName: string;
  contactEmail: string;
  contactCompany?: string;
  notes?: string;
  source?: string;
}

export interface CreatedBooking {
  eventId: string;
  joinUrl?: string;
  webLink?: string;
}

export async function createBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  const subjectCompany = input.contactCompany ? ` (${input.contactCompany})` : "";
  const subject = `AI Search report walkthrough / ${input.contactName}${subjectCompany}`;
  const bodyHtml = `
    <p>Report walkthrough booked via aisearchhelpers.com.</p>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(input.contactName)}</li>
      <li><strong>Email:</strong> ${escapeHtml(input.contactEmail)}</li>
      ${input.contactCompany ? `<li><strong>Company:</strong> ${escapeHtml(input.contactCompany)}</li>` : ""}
      ${input.source ? `<li><strong>Source:</strong> ${escapeHtml(input.source)}</li>` : ""}
    </ul>
    ${input.notes ? `<p><strong>Notes:</strong><br/>${escapeHtml(input.notes).replace(/\n/g, "<br/>")}</p>` : ""}
  `;

  const event = {
    subject,
    body: { contentType: "HTML", content: bodyHtml },
    start: { dateTime: input.startUtc.toISOString(), timeZone: "UTC" },
    end: { dateTime: input.endUtc.toISOString(), timeZone: "UTC" },
    attendees: [
      {
        emailAddress: { address: input.contactEmail, name: input.contactName },
        type: "required",
      },
    ],
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
    allowNewTimeProposals: false,
    responseRequested: true,
  };

  const created = await graph<{
    id: string;
    onlineMeeting?: { joinUrl?: string };
    webLink?: string;
  }>(`/users/${encodeURIComponent(OWNER)}/calendar/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });

  return {
    eventId: created.id,
    joinUrl: created.onlineMeeting?.joinUrl,
    webLink: created.webLink,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
