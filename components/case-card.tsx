import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { LeadRow } from "@/lib/domain";
import { formatValueScore, leadWhen, namedSite } from "@/lib/lead-presentation";

function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || "原文";
  } catch {
    return "原文";
  }
}

function trackLabel(code: string, names: Map<string, string>): string {
  const short = names.get(code)?.split(/[/／]/)[0]?.trim();
  return short ? `${code} ${short}` : code;
}

function marketSide(side: string | null): string | null {
  if (side === "supply") return "市场上在卖";
  if (side === "demand") return "市场上在找";
  if (side === "content") return "内容笔记";
  return null;
}

function usable(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  if (!text || /与\s*T\d{2}|映射\s*T|做个?\s*demo|demo 或申报|分数是价值分|信源回看约/.test(text)) return null;
  return text;
}

export function CaseCard({ lead, names }: { lead: LeadRow; names: Map<string, string> }) {
  const when = leadWhen(lead);
  const side = marketSide(lead.side);
  const signal = lead.signal?.trim() || null;
  const seen = usable(lead.summary);
  const fit = usable(lead.opportunity_note) || usable(lead.studio_angle);
  const site = namedSite(lead.site);
  const chips = [
    ...(lead.track_codes.length ? lead.track_codes : lead.track_code ? [lead.track_code] : []).map((code) => trackLabel(code, names)),
    formatValueScore(lead.score_total),
    when.label,
    lead.region?.trim() || null,
    site,
  ].filter((item): item is string => Boolean(item));

  return (
    <article className="opportunity-card" data-case-card data-lead-url={lead.url}>
      <VStack gap={3}>
        {side ? <Badge label={side} /> : null}
        <Text as="p" weight="medium" className="intel-hero">
          {lead.title}
        </Text>
        {signal ? (
          <VStack gap={1}>
            <Text as="p" type="supporting" className="intel-label">
              价格或信号
            </Text>
            <Text as="p">{signal}</Text>
          </VStack>
        ) : null}
        {seen && seen !== lead.title ? (
          <VStack gap={1}>
            <Text as="p" type="supporting" className="intel-label">
              看到的内容
            </Text>
            <Text as="p" className="intel-body">
              {seen}
            </Text>
          </VStack>
        ) : null}
        {fit ? (
          <VStack gap={1}>
            <Text as="p" type="supporting" className="intel-label">
              和我们能力的关系
            </Text>
            <Text as="p" className="intel-body">
              {fit}
            </Text>
          </VStack>
        ) : null}
        <Link href={lead.url} target="_blank" rel="noreferrer noopener">
          原文 · {hostLabel(lead.url)}
        </Link>
        {chips.length > 0 ? (
          <HStack gap={2} wrap="wrap">
            {chips.map((chip, index) => (
              <Badge key={`${chip}-${index}`} label={chip} />
            ))}
          </HStack>
        ) : null}
      </VStack>
    </article>
  );
}
