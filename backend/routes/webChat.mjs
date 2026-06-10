import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildAutomationReply } from "../services/automation/automationReplyService.mjs";
import { getCompany } from "../services/company/companyConfigService.mjs";
import { detectUnit } from "../services/router/routerService.mjs";
import { ensureDataFile } from "../utils/dataPaths.mjs";
import { evaluateLeadFunnel, evaluateLeadMenu, getLeadRules } from "./leadRules.mjs";

const MAX_MESSAGE_LENGTH = 1200;
let conversationsPath = null;

async function getConversationsPath() {
  conversationsPath = conversationsPath || await ensureDataFile("conversations.mock.json");
  return conversationsPath;
}

async function readConversations() {
  try {
    return JSON.parse(await readFile(await getConversationsPath(), "utf8"));
  } catch {
    return [];
  }
}

async function saveConversations(conversations) {
  await writeFile(await getConversationsPath(), JSON.stringify(conversations, null, 2));
}

export async function handleWebChatMessage(body) {
  const companyId = cleanText(body.companyId || "inversiones-manglar", 80);
  const sessionId = cleanText(body.sessionId, 120);
  const message = cleanText(body.message, MAX_MESSAGE_LENGTH);
  const customerName = cleanText(body.customerName || "Visitante web", 100);

  if (!sessionId || !message) {
    return {
      status: 400,
      body: { error: "La sesión y el mensaje son obligatorios." },
    };
  }

  const company = await getCompany(companyId);
  if (!company || company.active === false) {
    return {
      status: 404,
      body: { error: "El chat no está disponible en este momento." },
    };
  }

  const menu = await evaluateLeadMenu(companyId, `web:${sessionId}`, message);
  const funnel = await evaluateLeadFunnel(companyId, message);
  const leadRules = await getLeadRules(companyId);
  const unit = detectUnit(message, company);
  const result = menu
    ? {
        text: menu.text,
        shouldHandoff: Boolean(menu.shouldHandoff),
        priority: menu.shouldHandoff ? "alta" : "media",
      }
    : funnel
      ? {
          text: funnel.response || "Gracias. Un asesor humano continuará la atención.",
          shouldHandoff: Boolean(funnel.shouldHandoff),
          priority: funnel.priority || "media",
        }
      : {
          ...buildAutomationReply({ message, company, leadRules }),
          shouldHandoff: false,
          priority: "media",
        };

  const conversations = await readConversations();
  const now = new Date().toISOString();
  let conversation = conversations.find(
    (item) =>
      item.companyId === companyId &&
      item.channel === "webchat" &&
      item.customerId === sessionId,
  );

  if (!conversation) {
    conversation = {
      companyId,
      conversationId: `web-${randomUUID()}`,
      customerName,
      customerId: sessionId,
      channel: "webchat",
      unit: unit?.name || "Sitio web",
      status: "answered",
      priority: result.priority,
      lastMessageAt: now,
      summary: message,
      messages: [],
    };
    conversations.unshift(conversation);
  }

  conversation.customerName = customerName || conversation.customerName;
  conversation.unit = unit?.name || conversation.unit || "Sitio web";
  conversation.status = result.shouldHandoff ? "human_required" : conversation.status;
  conversation.priority = result.shouldHandoff ? result.priority : conversation.priority || "media";
  conversation.lastMessageAt = now;
  conversation.summary = /^\d+$/.test(message) && conversation.summary
    ? `${conversation.summary} · Opción ${message}`
    : message;
  conversation.messages.push(
    {
      id: `web-customer-${randomUUID()}`,
      sender: "customer",
      text: message,
      createdAt: now,
    },
    {
      id: `web-bot-${randomUUID()}`,
      sender: "bot",
      text: result.text,
      createdAt: new Date().toISOString(),
    },
  );

  if (result.shouldHandoff) {
    conversation.messages.push({
      id: `web-system-${randomUUID()}`,
      sender: "system",
      text: "Derivado a humano desde el chat del sitio web.",
      createdAt: new Date().toISOString(),
    });
  }

  await saveConversations(conversations);

  return {
    status: 200,
    body: {
      ok: true,
      reply: result.text,
      handoff: result.shouldHandoff,
      conversationId: conversation.conversationId,
      whatsappUrl: result.shouldHandoff ? buildWhatsAppUrl(company, conversation) : "",
    },
  };
}

function buildWhatsAppUrl(company, conversation) {
  const number = String(company.contact?.whatsapp || "").replace(/\D/g, "");
  if (!number) return "";

  const transcript = conversation.messages
    .filter((item) => item.sender === "customer" || item.sender === "bot")
    .slice(-8)
    .map((item) => `${item.sender === "customer" ? "Cliente" : "Asistente"}: ${item.text}`)
    .join("\n");
  const text = [
    "Hola, vengo del chat de imanglar.com y quiero continuar con un asesor.",
    "",
    transcript,
    "",
    `Referencia: ${conversation.conversationId}`,
  ].join("\n").slice(0, 1800);

  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, maxLength);
}
