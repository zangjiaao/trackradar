import assert from "node:assert/strict";
import test from "node:test";
import { extractNoticeFacts, repeatsTitle } from "../lib/notice-facts.ts";
import { readPolicy } from "../lib/policy-read.ts";

const XIAN = `
发布时间：2026-10-22 15:56
关于开展2026年中小企业数字化转型城市试点专项资金中小企业数字化改造项目（第五批）申报工作的通知
申报单位具备独立法人资格，且注册地和项目实施地均为西安市区域内（含西咸新区），属于制造业中小企业（划型标准：上年度营业收入4亿元以下，或从业人员1000人以下）。
在2026年10月25日前已完成改造且中小企业数字化水平自评达到二级及以上。
奖补范围。核算奖补的数字化改造投入主要包括与数字化改造相关的软件购买、软件开发、云服务及必要的实施服务支出。
按照不超过企业数字化改造项目核定投入费用的50%给予补助，其中数字化水平等级达到二级的企业补助不超过30万元，三级的企业补助不超过50万元，四级的企业补助不超过100万元。
申报单位须于10月30日前将申报资料提交至辖区工业和信息化主管部门。
申报单位须于11月3日前通过“数转系统”提交评测验收申请。
“西安市中小企业数字化转型发展一站式服务系统”（以下简称“数转系统”）。
数字化服务商原则上需通过专家评估并入资源池，未入库的需及时入库。
未被纳入失信惩戒主体名单。申报项目未获得过国家、省、市级财政资金支持。
联系人：王阳 029-67098976
`;

test("西安第五批通知抽出机会、福利、路径、门槛和联络人", () => {
  const facts = extractNoticeFacts(XIAN);
  assert.equal(facts.publishedAt, "2026-10-22 15:56");
  assert.match(facts.studioAngle ?? "", /软件开发/);
  assert.match(facts.studioAngle ?? "", /奖补申报/);
  assert.match(facts.studioAngle ?? "", /资源池/);
  assert.doesNotMatch(facts.studioAngle ?? "", /demo/);
  assert.match(facts.subsidyNote ?? "", /50%/);
  assert.match(facts.subsidyNote ?? "", /二级≤30万/);
  assert.match(facts.subsidyNote ?? "", /三级≤50万/);
  assert.match(facts.subsidyNote ?? "", /四级≤100万/);
  assert.match(facts.subsidyNote ?? "", /实施服务/);
  assert.match(facts.participationNote ?? "", /10月30日前/);
  assert.match(facts.participationNote ?? "", /11月3日前/);
  assert.match(facts.participationNote ?? "", /数转系统/);
  assert.match(facts.whoCanApply ?? "", /西安制造业中小企业/);
  assert.match(facts.whoCanApply ?? "", /2026年10月25日/);
  assert.match(facts.whoCanApply ?? "", /资源池/);
  assert.match(facts.contactNote ?? "", /王阳 029-67098976/);
  assert.match(facts.windowNote ?? "", /线下 10月30日前|线下10月30日前/);

  const reading = readPolicy(XIAN);
  assert.equal(reading.keep, true);
  assert.equal(reading.publishedAt, "2026-10-22 15:56");
  assert.doesNotMatch(`${reading.summary}${reading.opportunity}`, /与\s*T09|与T09/);
});

test("和标题重复的片段不算独立情报", () => {
  const title = "西安市工业和信息化局关于开展2026年中小企业数字化转型城市试点专项资金中小企业数字化改造项目（第五批）申报工作的通知";
  assert.equal(repeatsTitle(`…息化局关于开展2026年中小企业数字化转型城市试点专项资金…`, title), true);
  assert.equal(repeatsTitle("联系人：王阳 029-67098976", title), false);
});
