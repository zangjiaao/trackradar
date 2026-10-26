"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "总览" },
  { href: "/chat", label: "对话" },
  { href: "/tracks", label: "赛道" },
  { href: "/leads", label: "线索" },
  { href: "/samples", label: "采样" },
  { href: "/sources", label: "信源" },
  { href: "/prompts", label: "提示词" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="shrink-0 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">赛道雷达</span>
          <span className="text-xs text-muted-foreground">TrackRadar</span>
        </Link>
        <nav className="flex flex-wrap gap-1">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-md bg-primary px-2.5 py-1 text-sm text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    : "rounded-md px-2.5 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
