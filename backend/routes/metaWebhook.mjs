// GET  /webhook/meta — verificación Meta (compatible con /webhooks/meta existente)
// POST /webhook/meta — eventos entrantes (mock hasta tener Meta Business)
import { getAllCompanies, getCompany } from "../services/company/companyConfigService.mjs";
import { detectUnit }         from "../services/router/routerService.mjs";
import { buildSystemPrompt }  from "../services/ai/promptBuilder.mjs";
import { routeAI }            from "../services/ai/aiRouterService.mjs";
import { sendMessage }        from "../services/meta/metaService.mjs";
import { recordConversation } from "../services/billing/usageTracker.mjs";
import { evaluateLeadFunnel, evaluateLeadMenu, getLeadRules } from "./leadRules.mjs";
import { buildAutomationReply } from "../services/automation/automationReplyService.mjs";
import { logger }             from "../utils/logger.mjs";

export function handleWebhookVerification(url) {
  const mode      = url.searchParams.get("hub.mode");
  const token     = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = process.env.META_VERIFY_TOKEN ?? "dev_verify_token";

  if (mode === "subscribe" && token === verifyToken) {
    return { status: 200, body: challenge, raw: true };
  }
  return { status: 403, body: "Verification failed" };
}

export async function handleWebhookEvent(payload) {
  // Support both direct test payloads and real Meta webhook structure
  const incoming = extractMessage(payload);
  if (!incoming) {
    return { status: 200, body: { ok: true, received: false } };
  }

  const company = await resolveIncomingCompany(incoming);
  if (!company || !company.active) {
    return { status: 200, body: { ok: true, skipped: true } };
  }

  const unit = detectUnit(incoming.text, company);
  const menu = await evaluateLeadMenu(company.companyId, incoming.senderId, incoming.text);
  const funnel = await evaluateLeadFunnel(company.companyId, incoming.text);
  const leadRules = await getLeadRules(company.companyId);
  const aiAllowed = Boolean(company.planFeatures?.aiApi);
  const aiResult = menu
    ? {
        text: menu.text,
        provider: menu.provider,
        model: menu.model,
        estimatedCostUSD: 0,
      }
    : funnel?.shouldHandoff
    ? {
        text: funnel.response || "Recibimos tu solicitud. Un asesor humano continuará la atención.",
        provider: "handoff",
        model: `funnel:${funnel.id}`,
        estimatedCostUSD: 0,
      }
    : !aiAllowed
      ? buildAutomationReply({
          message: incoming.text,
          company,
          leadRules,
        })
    : await routeAI({
        company,
        systemPrompt: await buildSystemPrompt({ company, unit }),
        userMessage: incoming.text,
      });

  await sendMessage({
    channel:     incoming.channel,
    recipientId: incoming.senderId,
    text:        aiResult.text,
    phoneNumberId: incoming.phoneNumberId,
  });

  await recordConversation({
    companyId: company.companyId,
    channel:   incoming.channel,
    provider:  aiResult.provider,
    model:     aiResult.model,
    estimatedCostUSD: aiResult.estimatedCostUSD ?? 0,
  });

  logger.info("Webhook message handled", { companyId: company.companyId, channel: incoming.channel, funnel: funnel?.id, menu: menu?.id });
  return { status: 200, body: { ok: true, received: true, handoff: Boolean(funnel?.shouldHandoff || menu?.shouldHandoff) } };
}

function extractMessage(payload) {
  // Direct test format: { companyId, channel, from, message }
  if (payload.message && payload.from) {
    return {
      companyId: payload.companyId,
      channel:   payload.channel ?? "whatsapp",
      senderId:  payload.from,
      text:      payload.message,
    };
  }

  // WhatsApp Cloud API format
  const waValue   = payload.entry?.[0]?.changes?.[0]?.value;
  const waMessage = waValue?.messages?.[0];
  if (waMessage?.text?.body) {
    return {
      companyId:     null,
      channel:       "whatsapp",
      senderId:      waMessage.from,
      text:          waMessage.text.body,
      phoneNumberId: waValue.metadata?.phone_number_id,
    };
  }

  // Messenger / Instagram format
  const messaging = payload.entry?.[0]?.messaging?.[0];
  if (messaging?.message?.text) {
    return {
      companyId: null,
      channel:   payload.object === "instagram" ? "instagram" : "messenger",
      senderId:  messaging.sender?.id,
      text:      messaging.message.text,
    };
  }

  return null;
}

async function resolveIncomingCompany(incoming) {
  if (incoming.companyId) {
    return getCompany(incoming.companyId);
  }

  const companies = await getAllCompanies();
  if (incoming.phoneNumberId) {
    const matched = companies.find((company) =>
      (company.meta?.whatsappPhoneNumberIds || []).map(String).includes(String(incoming.phoneNumberId)),
    );

    if (matched) {
      return matched;
    }
  }

  const fallbackCompanyId = process.env.META_DEFAULT_COMPANY_ID || "inversiones-manglar";
  logger.warn("Meta company fallback used", {
    phoneNumberId: incoming.phoneNumberId,
    fallbackCompanyId,
  });
  return getCompany(fallbackCompanyId);
}
