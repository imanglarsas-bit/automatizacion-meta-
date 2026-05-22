import { callAnthropic } from "./anthropicService.mjs";
import { callOpenAI }    from "./openaiService.mjs";
import { logger }        from "../../utils/logger.mjs";
import { checkAiAccess } from "../billing/quotaService.mjs";
import { buildAutomationReply } from "../automation/automationReplyService.mjs";

// Estimate cost in USD based on token counts and provider
function estimateCost(provider, model, inputTokens, outputTokens) {
  const rates = {
    "claude-3-5-sonnet-20241022": { input: 3.0,  output: 15.0 },
    "claude-3-haiku-20240307":    { input: 0.25, output: 1.25 },
    "claude-3-opus-20240229":     { input: 15.0, output: 75.0 },
    "gpt-4o-mini":                { input: 0.15, output: 0.60 },
    "gpt-4.1":                    { input: 2.0,  output: 8.0  },
  };
  const rate = rates[model] ?? { input: 1.0, output: 5.0 };
  return ((inputTokens * rate.input) + (outputTokens * rate.output)) / 1_000_000;
}

// Select model based on message complexity to optimize cost
function selectModel(company, messageLength) {
  const isSimple = messageLength < 80;
  if (company.aiProvider === "anthropic") {
    return isSimple ? "claude-haiku-4-5-20251001" : (company.model ?? "claude-3-5-sonnet-20241022");
  }
  return isSimple ? "gpt-4o-mini" : (company.model ?? "gpt-4o-mini");
}

export async function routeAI({ company, systemPrompt, userMessage }) {
  const access = await checkAiAccess(company);
  if (!access.allowed) {
    return {
      ...buildAutomationReply({ message: userMessage, company }),
      reason: access.reason,
      plan: access.plan,
    };
  }

  const model = selectModel(company, userMessage.length);

  // Primary provider
  try {
    let result;
    if (company.aiProvider === "anthropic") {
      result = await callAnthropic({ model, systemPrompt, userMessage });
    } else {
      result = await callOpenAI({ model, systemPrompt, userMessage });
    }
    result.estimatedCostUSD = estimateCost(
      result.provider, result.model,
      result.inputTokens ?? 0, result.outputTokens ?? 0
    );
    return result;
  } catch (primaryError) {
    logger.warn("Primary AI provider failed, trying fallback", {
      primary: company.aiProvider,
      error: primaryError.message,
    });
  }

  // Fallback provider
  try {
    const fallbackProvider = company.fallbackProvider ?? (company.aiProvider === "anthropic" ? "openai" : "anthropic");
    const fallbackModel    = company.fallbackModel ?? "gpt-4o-mini";
    let result;
    if (fallbackProvider === "openai") {
      result = await callOpenAI({ model: fallbackModel, systemPrompt, userMessage });
    } else {
      result = await callAnthropic({ model: fallbackModel, systemPrompt, userMessage });
    }
    result.fallback = true;
    result.estimatedCostUSD = estimateCost(
      result.provider, result.model,
      result.inputTokens ?? 0, result.outputTokens ?? 0
    );
    logger.info("Fallback AI used", { provider: fallbackProvider });
    return result;
  } catch (fallbackError) {
    logger.error("Both AI providers failed", { error: fallbackError.message });
    return {
      text: "En este momento no podemos procesar tu solicitud automáticamente. Un asesor te contactará pronto.",
      mock: true,
      provider: "fallback-error",
      model: "none",
      estimatedCostUSD: 0,
    };
  }
}
