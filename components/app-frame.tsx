"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@astryxdesign/core/AppShell";
import { SiteNav } from "@/components/site-nav";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chat = pathname === "/chat";
  return (
    <AppShell
      height={chat ? "fill" : "auto"}
      variant="section"
      contentPadding={chat ? 0 : 4}
      mobileNav={false}
      topNav={<SiteNav />}
    >
      {children}
    </AppShell>
  );
}
