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
import { sendMessage }      from "../services/meta/metaService.mjs";

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

export async function handleSendMetaTest(body) {
  const to = String(body.to || "").replace(/[^\d]/g, "");
  const text = String(body.text || "").trim();
  const channel = String(body.channel || "whatsapp").trim().toLowerCase();
  const mode = String(body.mode || "template").trim().toLowerCase();

  if (channel !== "whatsapp") {
    return { status: 400, body: { error: "Por ahora la prueba real está disponible para WhatsApp." } };
  }

  if (!to || (mode === "text" && !text)) {
    return { status: 400, body: { error: "Número destino y mensaje son obligatorios." } };
  }

  const result = await sendMessage({
    channel,
    recipientId: to,
    text,
    templateName: mode === "template" ? "hello_world" : "",
    languageCode: "en_US",
  });

  if (result?.error || result?.skipped || (!result?.mock && !result?.messages?.[0]?.id)) {
    return {
      status: 502,
      body: {
        error: result?.error?.message || "Meta no confirmó el envío. Revisa token, Phone Number ID y número autorizado.",
        meta: result,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      channel,
      to,
      meta: result,
    },
  };
}
