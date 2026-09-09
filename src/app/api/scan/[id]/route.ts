import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scan = await store().getScan(id);
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ status: scan.status, step: scan.step, progress: scan.progress });
}

// Progressive lead enrichment: name, phone, qualifier land as the user advances.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const allowed = ["first_name", "last_name", "phone", "sms_consent", "qualifier"] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      const value = body[key];
      if (key === "sms_consent") {
        if (typeof value === "boolean") update[key] = value;
      } else if (typeof value === "string" && value.length <= 200) {
        update[key] = value.trim();
      }
    }
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const s = store();
  const lead = await s.getLeadForScan(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await s.updateLead(lead.id, update);
  return NextResponse.json({ ok: true });
}
