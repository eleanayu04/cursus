"use client";

import { useFormStatus } from "react-dom";

function Bookmark({ code, saved }: { code: string; saved: boolean }) {
  const { pending } = useFormStatus();
  // Flip as soon as it's tapped, so a slow connection still feels instant.
  const on = pending ? !saved : saved;
  return (
    <button
      aria-pressed={on}
      aria-label={`${code}: ${on ? "saved to Want to take" : "save to Want to take"}`}
      className={`flex h-full min-h-11 items-center px-4 ${on ? "text-accent" : "text-muted"}`}
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
    </button>
  );
}

/** Bookmark icon that adds a course to, or removes it from, Want to take. */
export function SaveCourseButton({
  code,
  saved,
  action,
}: {
  code: string;
  saved: boolean;
  action: () => Promise<void>;
}) {
  return (
    <form action={action} className="self-stretch">
      <Bookmark code={code} saved={saved} />
    </form>
  );
}
