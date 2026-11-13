import { AppShell } from "@astryxdesign/core/AppShell";
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
      {children}
    </AppShell>
  );
}
