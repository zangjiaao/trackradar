import { AppShell } from "@astryxdesign/core/AppShell";
import { LiveRefresh } from "@/components/live-refresh";
import { SiteNav } from "@/components/site-nav";

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      height="auto"
      variant="section"
      contentPadding={4}
      mobileNav={false}
      topNav={<SiteNav />}
    >
      <LiveRefresh />
      {children}
    </AppShell>
  );
}
