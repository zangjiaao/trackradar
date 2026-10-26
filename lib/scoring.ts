import { WEIGHTS } from "./domain";

export type ScoreParts = {
  capability: number;
  funding_window: number;
  demand_density: number;
  policy_heat: number;
  competition: number;
  demo_feasibility: number;
  total: number;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 骨架分：只根据标题线索给一个可解释的起点，不是调研结论。 */
export function skeletonScores(title: string, trackCode: string | null): ScoreParts {
  const policy = /通知|方案|申报|征集|指南|行动/.test(title) ? 82 : 58;
  const capability = trackCode ? 74 : 42;
  const funding = /资金|券|补贴|奖励|申报/.test(title) ? 70 : 48;
  const demand = /征集|需求|服务商|应用/.test(title) ? 68 : 50;
  const competition = /资源池|名录|推荐/.test(title) ? 46 : 55;
  const demo = trackCode && /T0[123]/.test(trackCode) ? 78 : trackCode ? 64 : 40;
  const total =
    capability * WEIGHTS.capability +
    funding * WEIGHTS.funding_window +
    demand * WEIGHTS.demand_density +
    policy * WEIGHTS.policy_heat +
    competition * WEIGHTS.competition +
    demo * WEIGHTS.demo_feasibility;
  return {
    capability: clamp(capability),
    funding_window: clamp(funding),
    demand_density: clamp(demand),
    policy_heat: clamp(policy),
    competition: clamp(competition),
    demo_feasibility: clamp(demo),
    total: round1(total),
  };
}
