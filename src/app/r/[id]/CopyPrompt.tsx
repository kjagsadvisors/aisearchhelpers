"use client";

import { useState } from "react";

export function CopyPrompt({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="shrink-0 text-xs rounded-lg border border-white/15 px-3 py-1.5 text-white/60 hover:text-white hover:border-white/30 transition-colors"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
