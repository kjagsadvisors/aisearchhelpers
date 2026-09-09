import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { brand } from "@/lib/brand";
import { store } from "@/lib/store";
import BookingWidget from "@/components/BookingWidget";

export const metadata: Metadata = {
  title: `Book your report walkthrough | ${brand.name}`,
  description: "A short Teams call to go over your AI search report.",
};

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ scan?: string }>;
}) {
  const { scan } = await searchParams;
  let prefill: { name: string; email: string; company: string } | null = null;
  if (scan && UUID_RE.test(scan)) {
    try {
      const lead = await store().getLeadForScan(scan);
      if (lead?.email) {
        const scanRow = await store().getScan(scan);
        prefill = {
          name: [lead.first_name, lead.last_name].filter(Boolean).join(" "),
          email: lead.email,
          company: scanRow?.report?.business_name || lead.domain,
        };
      }
    } catch {
      // fall through to the plain form
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <header>
          <a href="/">
            <Logo />
          </a>
        </header>

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Book your report walkthrough
          </h1>
          <p className="text-white/55">
            Pick a time below. It&apos;s a short Teams call to go over your report and what to
            fix first.
          </p>
        </div>

        <BookingWidget prefill={prefill} />

        <p className="text-xs text-white/30">
          You&apos;ll get a calendar invite with the Teams link right away.
        </p>
      </div>
    </main>
  );
}
