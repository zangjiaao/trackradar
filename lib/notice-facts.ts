export type NoticeFacts = {
  publishedAt: string | null;
  studioAngle: string | null;
  subsidyNote: string | null;
  participationNote: string | null;
  whoCanApply: string | null;
  contactNote: string | null;
  windowNote: string | null;
};

const EMPTY_FACTS: NoticeFacts = {
  publishedAt: null,
  studioAngle: null,
  subsidyNote: null,
  participationNote: null,
  whoCanApply: null,
  contactNote: null,
  windowNote: null,
};

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function repeatsTitle(excerpt: string | null | undefined, title: string | null | undefined): boolean {
  const norm = (value: string) => value.replace(/[\s.…·、，。,:：;；""「」]/g, "");
  const left = norm(excerpt ?? "");
  const right = norm(title ?? "");
  if (left.length < 8 || right.length < 8) return false;
  if (left.includes(right) || right.includes(left)) return true;
  const sample = right.slice(0, Math.min(18, right.length));
  return sample.length >= 8 && left.includes(sample);
}

function publishedAtFrom(text: string): string | null {
  const labeled = text.match(/发布时间[:：]\s*(20\d{2}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/);
  if (labeled) return labeled[2] ? `${labeled[1]} ${labeled[2]}` : labeled[1];
  const chinese = text.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2}:\d{2}))?/);
  if (!chinese) return null;
  const month = chinese[2].padStart(2, "0");
  const day = chinese[3].padStart(2, "0");
  return chinese[4] ? `${chinese[1]}-${month}-${day} ${chinese[4]}` : `${chinese[1]}-${month}-${day}`;
}

function levelCap(text: string, level: string): string | null {
  const match = text.match(new RegExp(`${level}[^，。]{0,20}?不超过\\s*(\\d+)\\s*万元`));
  return match ? `${level}≤${match[1]}万` : null;
}

function expenseTypes(text: string): string[] {
  return ["软件购买", "软件开发", "云服务", "实施服务"].filter((item) => text.includes(item));
}

function regionName(text: string): string | null {
  return ["西安", "上海", "北京", "深圳", "杭州", "武汉", "苏州", "成都", "宁波", "银川", "宁夏"].find((item) => text.includes(item)) ?? null;
}

/** 从通知正文抽出机会、福利、路径、门槛和联络人。没有的项留空。 */
export function extractNoticeFacts(text: string): NoticeFacts {
  const source = compact(text);
  if (!source) return { ...EMPTY_FACTS };
  const publishedAt = publishedAtFrom(source);
  const ratio = source.match(/不超过[^。%]{0,48}?(\d+)\s*%/);
  const caps = [levelCap(source, "二级"), levelCap(source, "三级"), levelCap(source, "四级")].filter((item): item is string => Boolean(item));
  const expenses = expenseTypes(source);
  const region = regionName(source);
  const batch = source.match(/第[一二三四五六七八九十0-9]+批/)?.[0] ?? null;
  const offline = source.match(/(\d{1,2}月\d{1,2}日前)将申报资料提交至辖区/)?.[1] ?? null;
  const online = source.match(/(\d{1,2}月\d{1,2}日前)通过[^。]{0,20}提交/)?.[1] ?? null;
  const finished = source.match(/(20\d{2}年\d{1,2}月\d{1,2}日)前已完成改造/)?.[1] ?? null;
  const hasPool = /资源池/.test(source);
  const hasSystem = /数转系统|一站式服务系统/.test(source);
  const manufacturing = /制造业中小企业/.test(source);
  const contact = source.match(/联系人[:：]\s*([\u4e00-\u9fa5]{2,4})\s+(0\d{2,3}-\d{7,8})/);
  const system = source.match(/“([^”]{6,40}系统)”/)?.[1] ?? (hasSystem ? "数转系统" : null);

  const benefitBits = [
    ratio ? `核定投入不超过 ${ratio[1]}%` : null,
    caps.length ? caps.join("，") : null,
    expenses.length ? `覆盖${expenses.join("、")}` : null,
    region ? `地域是${region}` : null,
  ].filter((item): item is string => Boolean(item));

  const whoBits = [
    manufacturing ? `${region ?? ""}制造业中小企业`.replace(/^制造业/, "制造业") : null,
    /注册地和项目实施地均为/.test(source) ? "注册地和项目实施地都要在本地" : null,
    /西咸新区/.test(source) ? "含西咸新区" : null,
    /4亿元以下/.test(source) ? "上年度营业收入 4 亿元以下，或从业人员 1000 人以下" : null,
  ].filter((item): item is string => Boolean(item));
  if (manufacturing && region) whoBits[0] = `${region}制造业中小企业`;

  const thresholdBits = [
    whoBits.length ? `申报对象是${whoBits.join("，")}。` : null,
    finished ? `改造须在${finished}前完成。` : null,
    /二级及以上/.test(source) ? "数字化水平自评要达到二级及以上。" : null,
    /失信/.test(source) ? "未被纳入失信名单。" : null,
    /财政资金|不再重复支持/.test(source) ? "没有拿过同类财政资金，不重复资助。" : null,
    hasPool ? "合同里的数字化服务商原则上要入资源池，还没入库的要补入库。" : null,
  ].filter((item): item is string => Boolean(item));

  const steps = [
    hasSystem ? "企业先在数转系统注册，完成试点企业入库和合同备案。" : null,
    offline ? `线下${offline}把申报材料交到辖区工信部门。` : null,
    online ? `线上${online}在数转系统提交评测验收。` : null,
    hasPool ? "服务商先入资源池，再签进改造合同。" : null,
  ].filter((item): item is string => Boolean(item));

  const windowBits = [
    offline ? `线下 ${offline}` : null,
    online ? `线上 ${online}` : null,
    finished ? `改造完成 ${finished}前` : null,
  ].filter((item): item is string => Boolean(item));

  let studioAngle: string | null = null;
  if (expenses.length && /申报|奖补|补助/.test(source)) {
    const where = region ? `${region}` : "";
    const who = manufacturing ? "制造业中小企业" : "企业";
    studioAngle = `帮${where}${who}做${batch ?? ""}数改里的${expenses.join("、")}，并协助准备奖补申报。`;
  }
  if (hasPool) {
    const poolLine = "工作室若作为服务商，要先入资源池，再进入改造合同里的软件开发或实施。";
    studioAngle = studioAngle ? `${studioAngle}${poolLine}` : poolLine;
  }

  const contactBits = [contact ? `${contact[1]} ${contact[2]}` : null, system ? `系统：${system}` : null].filter(
    (item): item is string => Boolean(item),
  );

  return {
    publishedAt,
    studioAngle,
    subsidyNote: benefitBits.length ? `${benefitBits.join("。")}。`.replace(/。。/g, "。") : null,
    participationNote: steps.length ? steps.join("") : null,
    whoCanApply: thresholdBits.length ? thresholdBits.join("") : null,
    contactNote: contactBits.length ? contactBits.join("。") : null,
    windowNote: windowBits.length ? windowBits.join(" · ") : null,
  };
}

export function fallbackStudioAngle(text: string): string {
  if (/资源池/.test(text)) return "准备材料进入人工智能服务商资源池，取得后续被点选的资格。";
  if (/智能体|Agent|agent/.test(text)) return "做这个场景里的软件助手，用来接交付。";
  if (/知识库|RAG|rag/.test(text)) return "做知识库入库和文档问答，用来接知识治理的单。";
  if (/模型券|算力券/.test(text)) return "帮企业把模型券或算力券落到可验收的软件场景，并准备申报材料。不做算力硬件。";
  return "";
}
