import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { LeadRow } from "@/lib/domain";
import { formatValueScore, leadWhen, namedOrigin, namedSide, namedSite } from "@/lib/lead-presentation";

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

function usable(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  if (!text || /与\s*T\d{2}|映射\s*T|做个?\s*demo|demo 或申报|分数是价值分|信源回看约/.test(text)) return null;
  return text;
}

function Fact({ label, body, hero = false }: { label: string; body: string | null; hero?: boolean }) {
  if (!body) return null;
  return (
    <VStack gap={1}>
      <Text as="p" type="supporting" className="intel-label">
        {label}
      </Text>
      <Text as="p" weight={hero ? "medium" : undefined} className={hero ? "intel-hero" : "intel-body"}>
        {body}
      </Text>
    </VStack>
  );
}

export function OpportunityCard({ lead, names }: { lead: LeadRow; names: Map<string, string> }) {
  const when = leadWhen(lead);
  const angle = usable(lead.studio_angle) || usable(lead.opportunity_note);
  const benefit = usable(lead.subsidy_note);
  const participation = usable(lead.participation_note);
  const threshold = usable(lead.who_can_apply);
  const contact = usable(lead.contact_note);
  const windows = (lead.window_note ?? "")
    .split("·")
    .map((item) => item.trim())
    .filter(Boolean);
  const site = namedSite(lead.site);
  const source = lead.source_name?.trim() || null;
  const chips = [
    ...(lead.track_codes.length ? lead.track_codes : lead.track_code ? [lead.track_code] : []).map((code) => trackLabel(code, names)),
    formatValueScore(lead.score_total),
    when.label,
    lead.region?.trim() || null,
    source,
    site && site !== source ? site : null,
    namedSide(lead.side),
    namedOrigin(lead.origin),
  ].filter((item): item is string => Boolean(item));

  return (
    <article className="opportunity-card" data-opportunity-card data-lead-url={lead.url}>
      <VStack gap={3}>
        <Fact label="我们有什么机会" body={angle} hero />
        {windows.length > 0 ? (
          <HStack gap={2} wrap="wrap">
            {windows.map((item) => (
              <Badge key={item} label={item} />
            ))}
          </HStack>
        ) : null}
        <Fact label="政策有什么福利" body={benefit} />
        <Fact label="如何参与" body={participation} />
        <Fact label="门槛" body={threshold} />
        <Fact label="联络人" body={contact} />
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
