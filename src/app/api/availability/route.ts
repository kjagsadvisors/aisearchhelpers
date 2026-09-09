import { NextResponse } from "next/server";
import { bookingConfig } from "@/lib/booking-config";
import { getBusyBlocks } from "@/lib/msgraph";
import { generateCandidateSlots, filterAvailable } from "@/lib/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + (bookingConfig.maxDaysAhead + 1) * 86400_000);
    const candidates = generateCandidateSlots(now);
    const busy = await getBusyBlocks(now, horizon);
    const slots = filterAvailable(candidates, busy);
    return NextResponse.json({
      timezone: bookingConfig.timezone,
      slotMinutes: bookingConfig.slotMinutes,
      slots,
    });
  } catch (err) {
    console.error("availability error", err);
    return NextResponse.json({ error: "Could not load availability" }, { status: 500 });
  }
}
