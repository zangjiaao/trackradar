"use client";

import Link from "next/link";
import { InternationalizationProvider } from "@astryxdesign/core/i18n";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import zhCN from "@astryxdesign/core/locales/zh-CN.generated.js";
import { defaultThemeSlug, themes } from "@/astryx-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={themes[defaultThemeSlug]}>
      <InternationalizationProvider locale="zh-CN" messages={{ "zh-CN": zhCN }}>
        <LinkProvider component={Link}>{children}</LinkProvider>
      </InternationalizationProvider>
    </Theme>
  );
}
