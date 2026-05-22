import { getUsage }  from "./usageTracker.mjs";
import { FEATURES, getPlan, hasFeature } from "./plans.mjs";
import { logger }    from "../../utils/logger.mjs";

export async function checkQuota(company) {
  const plan   = getPlan(company.plan);
  const limit  = company.monthlyConversationLimit ?? plan.monthlyConversationLimit ?? plan.monthlyMessageLimit;
  const usage  = await getUsage(company.companyId);
  const current = usage?.conversations ?? 0;

  if (current >= limit) {
    logger.warn("Quota exceeded", { companyId: company.companyId, current, limit });
    return { allowed: false, current, limit };
  }

  return { allowed: true, current, limit };
}

export async function checkAiAccess(company) {
  const plan = getPlan(company.plan);
  const usage = await getUsage(company.companyId);
  const current = countAiCalls(usage);
  const limit = company.monthlyAiRequestLimit ?? plan.monthlyAiRequestLimit;

  if (!hasFeature(company, FEATURES.AI_API)) {
    logger.warn("AI API blocked by plan", { companyId: company.companyId, plan: plan.key });
    return {
      allowed: false,
      reason: "AI_NOT_INCLUDED",
      current,
      limit: 0,
      plan: plan.key,
    };
  }

  if (Number.isFinite(limit) && current >= limit) {
    logger.warn("AI API quota exceeded", { companyId: company.companyId, current, limit, plan: plan.key });
    return {
      allowed: false,
      reason: "AI_QUOTA_EXCEEDED",
      current,
      limit,
      plan: plan.key,
    };
  }

  return {
    allowed: true,
    current,
    limit,
    plan: plan.key,
    limited: Boolean(plan.features[FEATURES.LIMITED_AI_API]),
  };
}

function countAiCalls(usage) {
  if (!usage?.byProvider) return 0;

  return Object.entries(usage.byProvider)
    .filter(([provider]) => provider !== "automation" && provider !== "mock")
    .reduce((total, [, item]) => total + Number(item.calls || 0), 0);
}
