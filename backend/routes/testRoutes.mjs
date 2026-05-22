// POST /api/test-message  — prueba el flujo completo sin Meta real
import { getCompany }       from "../services/company/companyConfigService.mjs";
import { detectUnit }       from "../services/router/routerService.mjs";
import { buildSystemPrompt } from "../services/ai/promptBuilder.mjs";
import { routeAI }          from "../services/ai/aiRouterService.mjs";
import { checkQuota }       from "../services/billing/quotaService.mjs";
import { recordConversation } from "../services/billing/usageTracker.mjs";
import { evaluateLeadFunnel } from "./leadRules.mjs";
import { handleJuridico }   from "../flows/juridico.mjs";
import { handleConsulting } from "../flows/consulting.mjs";
import { handleHotel }      from "../flows/hotel.mjs";
import { logger }           from "../utils/logger.mjs";

const FLOW_MAP = {
  juridico:   handleJuridico,
  consulting: handleConsulting,
  hotel:      handleHotel,
};

export async function handleTestMessage(body) {
  const { companyId, channel = "whatsapp", from = "anonymous", message } = body;

  if (!companyId || !message) {
    return { status: 400, body: { error: "companyId y message son requeridos." } };
  }

  const company = await getCompany(companyId);
  if (!company) {
    return { status: 404, body: { error: `Empresa '${companyId}' no encontrada.` } };
  }

  if (!company.active) {
    return { status: 403, body: { error: "Empresa inactiva." } };
  }

  const quota = await checkQuota(company);
  if (!quota.allowed) {
    return {
      status: 429,
      body: { error: "Límite mensual de conversaciones alcanzado.", ...quota },
    };
  }

  const unit = detectUnit(message, company);
  const flowHandler = unit ? FLOW_MAP[unit.type] : null;
  const funnel = await evaluateLeadFunnel(company.companyId, message);

  let result;
  if (funnel?.shouldHandoff) {
    result = {
      unit: unit?.name || "Embudo comercial",
      unitType: unit?.type || "lead_funnel",
      text: funnel.response || "Caso derivado a un asesor humano por regla de embudo.",
      provider: "handoff",
      model: `funnel:${funnel.id}`,
      estimatedCostUSD: 0,
      funnel,
    };
  } else if (flowHandler) {
    result = await flowHandler({ company, unit, message });
  } else {
    // No unit detected — use general company prompt
    const systemPrompt = await buildSystemPrompt({ company, unit: null });
    const aiResult = await routeAI({ company, systemPrompt, userMessage: message });
    result = { unit: "General", unitType: null, ...aiResult };
  }

  await recordConversation({
    companyId,
    channel,
    provider: result.provider,
    model:    result.model,
    estimatedCostUSD: result.estimatedCostUSD ?? 0,
  });

  logger.info("Test message processed", { companyId, channel, unit: result.unit, provider: result.provider });

  return {
    status: 200,
    body: {
      companyId,
      channel,
      from,
      unit:     result.unit,
      unitType: result.unitType,
      provider: result.provider,
      model:    result.model,
      mock:     result.mock ?? false,
      funnel:   result.funnel ?? null,
      handoff:  result.provider === "handoff",
      reply:    result.text,
    },
  };
}
