"use client";

import { useState } from "react";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";

function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || "原链接";
  } catch {
    return "原链接";
  }
}

export function LeadCell({
  title,
  url,
  summary,
  excerpt,
  opportunity,
}: {
  title: string;
  url: string;
  summary: string | null;
  excerpt: string | null;
  opportunity: string | null;
}) {
  const [open, setOpen] = useState(false);
  const preview = summary || opportunity || excerpt || "";
  const hasDetail = Boolean(summary || excerpt || opportunity);

  return (
    <VStack gap={1}>
      <Text weight="medium" maxLines={2} hasTruncateTooltip>
        {title}
      </Text>
      <Link href={url} target="_blank" rel="noreferrer noopener">
        {hostLabel(url)}
      </Link>
      {hasDetail ? (
        <VStack gap={1}>
          {open ? (
            <VStack gap={1}>
              {summary ? (
                <Text type="supporting" as="p">
                  解读：{summary}
                </Text>
              ) : null}
              {excerpt ? (
                <Text type="supporting" as="p">
                  相关片段：{excerpt}
                </Text>
              ) : null}
              {opportunity ? (
                <Text type="supporting" as="p">
                  机会：{opportunity}
                </Text>
              ) : null}
            </VStack>
          ) : (
            <Text type="supporting" as="p" maxLines={2} hasTruncateTooltip={false}>
              {preview}
            </Text>
          )}
          <button type="button" className="lead-toggle" onClick={() => setOpen((value) => !value)}>
            {open ? "收起解读" : "展开解读"}
          </button>
        </VStack>
      ) : null}
    </VStack>
  );
}
