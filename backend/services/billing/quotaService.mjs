import { getUsage }  from "./usageTracker.mjs";
import { getPlan }   from "./plans.mjs";
import { logger }    from "../../utils/logger.mjs";

export async function checkQuota(company) {
  const plan   = getPlan(company.plan);
  const limit  = company.monthlyConversationLimit ?? plan.monthlyConversationLimit;
  const usage  = await getUsage(company.companyId);
  const current = usage?.conversations ?? 0;

  if (current >= limit) {
    logger.warn("Quota exceeded", { companyId: company.companyId, current, limit });
    return { allowed: false, current, limit };
  }

  return { allowed: true, current, limit };
}
