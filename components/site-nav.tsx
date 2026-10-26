"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";

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
    <TopNav
      label="主导航"
      heading={<TopNavHeading heading="赛道雷达" subheading="TrackRadar" headingHref="/" as={Link} />}
      startContent={LINKS.map((link) => {
        const selected = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <TopNavItem key={link.href} as={Link} href={link.href} label={link.label} isSelected={selected} />
        );
      })}
    />
  );
}
