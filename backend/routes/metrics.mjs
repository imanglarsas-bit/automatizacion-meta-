// GET /api/metrics/company/:id — métricas de consumo por empresa
import { getUsage }   from "../services/billing/usageTracker.mjs";
import { getCompany } from "../services/company/companyConfigService.mjs";
import { getPlan }    from "../services/billing/plans.mjs";

export async function handleGetMetrics(companyId) {
  const company = await getCompany(companyId);
  if (!company) return { status: 404, body: { error: "Empresa no encontrada." } };

  const usage = await getUsage(companyId);
  const plan  = getPlan(company.plan);
  const aiUsage = countAiCalls(usage);

  return {
    status: 200,
    body: {
      companyId,
      plan: plan.key,
      planName: plan.name,
      limits: {
        messages: company.monthlyMessageLimit ?? plan.monthlyMessageLimit,
        conversations: company.monthlyConversationLimit ?? plan.monthlyConversationLimit,
        aiRequests: company.monthlyAiRequestLimit ?? plan.monthlyAiRequestLimit,
      },
      features: plan.features,
      limit: company.monthlyConversationLimit ?? plan.monthlyConversationLimit,
      usage: usage ?? {
        month: new Date().toISOString().slice(0, 7),
        conversations: 0,
        messages: 0,
        estimatedCostUSD: 0,
        byProvider: {},
        byChannel: {},
        daily: [],
      },
      aiUsage,
    },
  };
}

function countAiCalls(usage) {
  if (!usage?.byProvider) return 0;

  return Object.entries(usage.byProvider)
    .filter(([provider]) => provider !== "automation" && provider !== "mock")
    .reduce((total, [, item]) => total + Number(item.calls || 0), 0);
}
