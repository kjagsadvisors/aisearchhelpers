import { Logo } from "@/components/Logo";
import { brand } from "@/lib/brand";

export const metadata = { title: `Privacy Policy | ${brand.name}` };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <header className="flex items-center justify-between">
          <a href="/">
            <Logo />
          </a>
        </header>

        <h1 className="font-display text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-white/40">Last updated: September 9, 2026</p>

        <div className="space-y-6 text-sm text-white/70 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-white font-semibold text-base">What we collect</h2>
            <p>
              When you run a scan, we collect the website URL you enter, your name, email
              address, phone number, the revenue range you select, and your IP address. We also
              generate and store the report our system produces about the website you submitted.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-semibold text-base">How we use it</h2>
            <p>
              To generate and deliver your report, to contact you about your results and about
              services related to them (including by phone or text message from a real person if
              you provided a number), and to improve the product. Scan processing uses
              third-party AI providers (Anthropic, and OpenAI via OpenRouter) that receive the
              content of your public website, but not your contact details.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-semibold text-base">Sharing and sale of information</h2>
            <p>
              We may share or sell lead information (name, contact details, business website,
              and report summary) to marketing and service partners, such as agencies that
              provide the kinds of services your report identifies. Under certain state laws,
              including the California Consumer Privacy Act, this may be considered a
              &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; of personal information.
            </p>
            <p className="text-white/85 font-medium">
              To opt out of the sale or sharing of your information, email{" "}
              <a href={`mailto:privacy@${brand.domain}`} className="underline text-[var(--accent-hover)]">
                privacy@{brand.domain}
              </a>{" "}
              with the subject &ldquo;Do Not Sell My Information&rdquo; and the email address you
              used. We honor opt-outs within 15 business days.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-semibold text-base">Service providers</h2>
            <p>
              We use Vercel (hosting), Supabase (data storage), Anthropic and OpenRouter (AI
              processing), and email delivery providers to operate the service. Each processes
              data only to provide their service to us.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-semibold text-base">Retention and deletion</h2>
            <p>
              We keep lead and report data while it remains useful for the purposes above. You
              can request deletion of your information at any time by emailing{" "}
              <a href={`mailto:privacy@${brand.domain}`} className="underline text-[var(--accent-hover)]">
                privacy@{brand.domain}
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-semibold text-base">Contact</h2>
            <p>
              {brand.name} is operated by Kjags Advisors. Questions:{" "}
              <a href={`mailto:privacy@${brand.domain}`} className="underline text-[var(--accent-hover)]">
                privacy@{brand.domain}
              </a>
              .
            </p>
          </section>
        </div>

        <footer className="border-t border-white/10 pt-6 text-xs text-white/25">
          <a href="/" className="hover:text-white/60">{brand.domain}</a> ·{" "}
          <a href="/terms" className="hover:text-white/60">Terms</a>
        </footer>
      </div>
    </main>
  );
}
