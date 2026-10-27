export type ZhejiangUnit = {
  endpoint: string;
  tagId: string;
  params: Record<string, string>;
};

function readAttr(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  if (!match) return null;
  return match[1] ?? match[2] ?? "";
}

/** 浙江集约化栏目页把通知列表放在 jpaas build/unit，参数写在 script 的 queryData 上。 */
export function findZhejiangUnits(html: string): ZhejiangUnit[] {
  const units: ZhejiangUnit[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = match[1] ?? "";
    const endpoint = readAttr(attrs, "url");
    const raw = readAttr(attrs, "queryData");
    if (!endpoint || !raw || !endpoint.includes("jpaas-publish-server/front/page/build/unit")) continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.replace(/'/g, '"')) as Record<string, unknown>;
    } catch {
      continue;
    }
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value == null) continue;
      params[key] = String(value);
    }
    units.push({ endpoint, tagId: params.tagId ?? "", params });
  }
  return units;
}

/** 有「列表」单元时只请求列表，避免把页头、导航也拉一遍。 */
export function preferListUnits(units: ZhejiangUnit[]): ZhejiangUnit[] {
  const lists = units.filter((unit) => unit.tagId.includes("列表"));
  return lists.length > 0 ? lists : units;
}

export function zhejiangUnitUrl(pageUrl: string, unit: ZhejiangUnit): string {
  const url = new URL(unit.endpoint, pageUrl);
  for (const [key, value] of Object.entries(unit.params)) url.searchParams.set(key, value);
  return url.href;
}
