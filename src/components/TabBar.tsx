"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Feed", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/search", label: "Search", icon: "M11 4a7 7 0 100 14 7 7 0 000-14zm9 16l-4.35-4.35" },
  { href: "/rate", label: "Rate", icon: "M12 5v14M5 12h14", primary: true },
  { href: "/lists", label: "Lists", icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
  {
    href: "/profile",
    label: "Profile",
    icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0",
  },
];

export function TabBar() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => (
          <li key={t.href} className="flex-1">
            <Link
              href={t.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                active(t.href) ? "text-accent" : "text-muted"
              }`}
            >
              <span
                className={
                  t.primary
                    ? "flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white"
                    : "flex h-8 w-8 items-center justify-center"
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={t.icon} />
                </svg>
              </span>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
