import { Logo } from "@/components/Logo";
import { brand } from "@/lib/brand";

export const metadata = { title: `Terms of Service | ${brand.name}` };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <header className="flex items-center justify-between">
          <a href="/">
            <Logo />
          </a>
        </header>

        <h1 className="font-display text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-white/40">Last updated: September 9, 2026</p>

        <div className="space-y-6 text-sm text-white/70 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-white font-semibold text-base">The service</h2>
            <p>
              {brand.name} generates a free AI search visibility report about a website you
              submit. Reports are produced automatically using AI systems and public data
              sources. One free scan per business; we may rate-limit or refuse scans to prevent
              abuse.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-semibold text-base">Your submission</h2>
            <p>
              Only submit websites you own or are authorized to evaluate. You confirm the
              contact information you provide is your own.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-semibold text-base">Reports are informational</h2>
            <p>
              Reports reflect automated, point-in-time observations of public AI assistant
              responses and public website data. AI responses vary and change. Reports are not
              professional, legal, or financial advice, and we make no guarantee that following
              any recommendation will produce any particular result.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-semibold text-base">No warranty; limitation of liability</h2>
            <p>
              The service is provided &ldquo;as is&rdquo; without warranties of any kind. To the
              maximum extent permitted by law, Kjags Advisors is not liable for any indirect,
              incidental, or consequential damages arising from use of the service, and our
              total liability for any claim is limited to $100.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-semibold text-base">Privacy</h2>
            <p>
              Our <a href="/privacy" className="underline text-[var(--accent-hover)]">Privacy Policy</a>{" "}
              explains what we collect and how we use and share it, including how to opt out of
              the sale or sharing of your information.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-semibold text-base">Governing law</h2>
            <p>These terms are governed by the laws of the State of Maryland, USA.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-semibold text-base">Contact</h2>
            <p>
              Kjags Advisors ·{" "}
              <a href={`mailto:hello@${brand.domain}`} className="underline text-[var(--accent-hover)]">
                hello@{brand.domain}
              </a>
            </p>
          </section>
        </div>

        <footer className="border-t border-white/10 pt-6 text-xs text-white/25">
          <a href="/" className="hover:text-white/60">{brand.domain}</a> ·{" "}
          <a href="/privacy" className="hover:text-white/60">Privacy</a>
        </footer>
      </div>
    </main>
  );
}
