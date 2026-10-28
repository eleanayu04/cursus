"use client";

import { useEffect, useState } from "react";

/** Shows and copies an absolute link to `path` on the current site. */
export function CopyLink({ path }: { path: string }) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(window.location.origin + path), [path]);

  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-subtle px-3 py-2 text-xs">{url}</code>
      <button
        onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ title: "Join me on Cursus", url });
            else await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // share sheet dismissed
          }
        }}
        className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white"
      >
        {copied ? "Copied" : "Share"}
      </button>
    </div>
  );
}
