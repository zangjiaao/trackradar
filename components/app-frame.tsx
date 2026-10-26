"use client";

import { usePathname } from "next/navigation";
import { SiteNav } from "@/components/site-nav";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chat = pathname === "/chat";

  return (
    <div data-chat-shell={chat ? "" : undefined} className={chat ? "flex h-dvh flex-col overflow-hidden" : undefined}>
      <SiteNav />
      <main
        className={
          chat
            ? "mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 pt-4 pb-3"
            : "mx-auto w-full max-w-6xl px-4 py-8"
        }
      >
        {children}
      </main>
    </div>
  );
}
