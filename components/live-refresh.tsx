"use client";

import { useEffect, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Visible dashboards reconcile server data every five seconds and on focus. */
export function LiveRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!["/", "/cases", "/tasks"].includes(pathname)) return;
    const refresh = () => {
      if (pending || document.visibilityState !== "visible" || !navigator.onLine) return;
      // Leave open forms and editing alone; the next interval catches up afterwards.
      if (Array.from(document.querySelectorAll('[role="dialog"]')).some((dialog) => dialog.getClientRects().length > 0)) return;
      if (document.activeElement?.matches('input:not([type="checkbox"]), textarea, [contenteditable="true"]')) return;
      startTransition(() => router.refresh());
    };
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname, router, pending]);
  return null;
}
