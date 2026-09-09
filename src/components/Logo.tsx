import { brandWordmark } from "@/lib/brand";

// Search lens + AI spark, drawn in the brand accent so it adapts to any
// white-label palette. Pure component - safe in server and client trees.
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle
        cx="14"
        cy="14"
        r="9.5"
        stroke="var(--accent)"
        strokeWidth="2.6"
      />
      <line
        x1="21.2"
        y1="21.2"
        x2="28"
        y2="28"
        stroke="var(--accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M14 8.6 L15.6 12.4 L19.4 14 L15.6 15.6 L14 19.4 L12.4 15.6 L8.6 14 L12.4 12.4 Z"
        fill="var(--accent)"
      />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  const { head, tail } = brandWordmark();
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
      <LogoMark size={compact ? 22 : 26} />
      <span
        className={`font-display font-bold uppercase leading-none ${
          compact ? "text-sm tracking-[0.12em]" : "text-base tracking-[0.14em]"
        }`}
      >
        {head && <span className="text-white">{head}</span>}
        {head && <span className="text-white/30 mx-1.5">/</span>}
        <span className="text-[var(--accent)]">{tail}</span>
      </span>
    </span>
  );
}
