import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { LeadRow } from "@/lib/domain";
import { leadWhen } from "@/lib/lead-presentation";
import { policyCardReading, policyScoreLabel } from "@/lib/policy-card-copy";

export function OpportunityCard({ lead }: { lead: LeadRow }) {
  const when = leadWhen(lead);
  const reading = policyCardReading(lead);
  const score = policyScoreLabel(lead.score_total);
  const place = lead.region?.trim() || null;
  const meta = [place, when.label].filter(Boolean).join(" · ");

  return (
    <article className="opportunity-card policy-card" data-opportunity-card data-lead-url={lead.url}>
      <VStack gap={3}>
        <div className="policy-card-top">
          <div className="policy-reading">{reading ? <Text as="p">{reading}</Text> : null}</div>
          <Text
            as="p"
            weight={score.scored ? "semibold" : "normal"}
            type={score.scored ? "body" : "supporting"}
            size={score.scored ? "xl" : "sm"}
            className="policy-score"
            aria-label={score.scored ? `价值分 ${score.text}` : "未评分"}
            data-policy-score={score.text}
          >
            {score.text}
          </Text>
        </div>
        <Link
          href={lead.url}
          target="_blank"
          rel="noreferrer noopener"
          hasUnderline
          color="primary"
          display="block"
          className="policy-title"
        >
          {lead.title}
        </Link>
        {meta ? (
          <Text as="p" type="supporting" className="policy-meta">
            {meta}
          </Text>
        ) : null}
      </VStack>
    </article>
  );
}
