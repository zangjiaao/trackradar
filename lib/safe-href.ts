const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (!value || /^\s*javascript:/i.test(href) || value.startsWith("//")) return false;
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("?")) return true;
  try {
    const url = new URL(value);
    return SAFE_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}
