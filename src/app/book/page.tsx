import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { brand } from "@/lib/brand";
import BookingWidget from "@/components/BookingWidget";

export const metadata: Metadata = {
  title: `Book your report walkthrough | ${brand.name}`,
  description:
    "A quick Teams call. We go through your AI search report together and your highest-impact fixes.",
};

export default function BookPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
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
            A quick call on Teams. We go through your report together: what it found, which
            fixes matter most, and what you can do yourself. Bring questions. No pitch deck.
          </p>
        </div>

        <BookingWidget />

        <p className="text-xs text-white/30">
          You&apos;ll get a calendar invite with a Teams link the moment you pick a time.
        </p>
      </div>
    </main>
  );
}
