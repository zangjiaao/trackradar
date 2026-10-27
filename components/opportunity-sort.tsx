"use client";

import { useRouter } from "next/navigation";
import { Selector } from "@astryxdesign/core/Selector";
import { LEAD_SORT_OPTIONS, opportunityHref, parseLeadSort, type LeadSort } from "@/lib/lead-presentation";

export function OpportunitySort({ track, sort, base = "/" }: { track: string | null; sort: LeadSort; base?: "/" | "/cases" }) {
  const router = useRouter();
  return (
    <div className="sort-select">
      <Selector
        label="排序"
        value={sort}
        options={LEAD_SORT_OPTIONS.map(({ value, label }) => ({ value, label }))}
        onChange={(value) => router.push(opportunityHref(track, parseLeadSort(value), base))}
        width="100%"
      />
    </div>
  );
}
