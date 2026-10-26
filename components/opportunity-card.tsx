import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { LeadRow } from "@/lib/domain";
import {
  formatValueScore,
  leadWhen,
  namedOrigin,
  namedSide,
  namedSite,
  presentReading,
  scoreBreakdown,
  shortExcerpt,
} from "@/lib/lead-presentation";
import type { TrackDictionary } from "@/lib/guess";

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

export function OpportunityCard({
  lead,
  names,
  dictionaries,
}: {
  lead: LeadRow;
  names: Map<string, string>;
  dictionaries?: TrackDictionary[];
}) {
  const when = leadWhen(lead);
  const reading = presentReading(lead, dictionaries);
  const breakdown = scoreBreakdown(lead);
  const excerpt = shortExcerpt(reading.excerpt);
  const site = namedSite(lead.site);
  const source = lead.source_name?.trim() || null;
  const chips = [
    ...(lead.track_codes.length ? lead.track_codes : lead.track_code ? [lead.track_code] : []).map((code) => trackLabel(code, names)),
    lead.region?.trim() || null,
    source,
    site && site !== source ? site : null,
    namedSide(lead.side),
    namedOrigin(lead.origin),
  ].filter((item): item is string => Boolean(item));

  return (
    <article className="opportunity-card" data-opportunity-card>
      <VStack gap={3}>
        <HStack gap={2} wrap="wrap" justify="between" vAlign="end">
          <Text as="p" weight="medium" className="value-score">
            {formatValueScore(lead.score_total)}
          </Text>
          <Text as="p" type="supporting">
            {when.label}
          </Text>
        </HStack>
        {breakdown ? (
          <Text as="p" type="supporting" className="score-parts">
            {breakdown}
          </Text>
        ) : null}
        {reading.opportunity ? (
          <VStack gap={1}>
            <Text as="p" type="supporting">
              机会分析
            </Text>
            <Text as="p" weight="medium" className="opportunity-analysis">
              {reading.opportunity}
            </Text>
          </VStack>
        ) : null}
        {reading.summary ? (
          <VStack gap={1}>
            <Text as="p" type="supporting">
              解读
            </Text>
            <Text as="p" className="opportunity-summary">
              {reading.summary}
            </Text>
          </VStack>
        ) : null}
        {excerpt ? (
          <VStack gap={1}>
            <Text as="p" type="supporting">
              相关片段
            </Text>
            <Text as="p" type="supporting" className="opportunity-excerpt">
              {excerpt}
            </Text>
          </VStack>
        ) : null}
        <VStack gap={1} className="opportunity-source">
          <Text as="p" type="supporting" maxLines={2} hasTruncateTooltip>
            {lead.title}
          </Text>
          <Link href={lead.url} target="_blank" rel="noreferrer noopener">
            原文 · {hostLabel(lead.url)}
          </Link>
        </VStack>
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
