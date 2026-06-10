import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildAutomationReply } from "../services/automation/automationReplyService.mjs";
import { getCompany } from "../services/company/companyConfigService.mjs";
import { detectUnit } from "../services/router/routerService.mjs";
import { ensureDataFile } from "../utils/dataPaths.mjs";
import { evaluateLeadFunnel, evaluateLeadMenu, getLeadRules } from "./leadRules.mjs";

const MAX_MESSAGE_LENGTH = 1200;
let conversationsPath = null;
let webChatQueue = Promise.resolve();

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

export function handleWebChatMessage(body) {
  return enqueueWebChat(() => processWebChatMessage(body));
}

export function handleWebChatContact(body) {
  return enqueueWebChat(() => processWebChatContact(body));
}

function enqueueWebChat(operation) {
  const task = webChatQueue.then(operation);
  webChatQueue = task.catch(() => {});
  return task;
}

async function processWebChatMessage(body) {
  const companyId = cleanText(body.companyId || "inversiones-manglar", 80);
  const sessionId = cleanText(body.sessionId, 120);
  const message = cleanText(body.message, MAX_MESSAGE_LENGTH);
  const customerName = cleanText(body.customerName || "Visitante web", 100);
  const pageContext = normalizePageContext(body.pageContext);

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

  const routingMessage = pageContext ? `${pageContext} ${message}` : message;
  const senderId = `web:${sessionId}`;
  let menu = await evaluateLeadMenu(companyId, senderId, message);
  if (!menu && pageContext) {
    menu = await evaluateLeadMenu(companyId, senderId, routingMessage);
  }
  const funnel = await evaluateLeadFunnel(companyId, message)
    || (pageContext ? await evaluateLeadFunnel(companyId, routingMessage) : null);
  const leadRules = await getLeadRules(companyId);
  const unit = detectUnit(routingMessage, company);
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
      requiresContact: result.shouldHandoff,
      conversationId: conversation.conversationId,
      whatsappUrl: "",
    },
  };
}

async function processWebChatContact(body) {
  const companyId = cleanText(body.companyId || "inversiones-manglar", 80);
  const sessionId = cleanText(body.sessionId, 120);
  const conversationId = cleanText(body.conversationId, 120);
  const lead = {
    name: cleanText(body.name, 100),
    phone: cleanText(body.phone, 30),
    email: cleanText(body.email, 140).toLowerCase(),
    city: cleanText(body.city, 100),
    company: cleanText(body.company, 140),
    consent: body.consent === true,
  };

  if (!sessionId || !conversationId || !lead.name || !lead.phone || !lead.email || !lead.city) {
    return {
      status: 400,
      body: { error: "Nombre, teléfono, correo y ciudad son obligatorios." },
    };
  }
  if (!lead.consent) {
    return {
      status: 400,
      body: { error: "Debes autorizar el tratamiento de datos para continuar." },
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    return {
      status: 400,
      body: { error: "Ingresa un correo electrónico válido." },
    };
  }

  const company = await getCompany(companyId);
  if (!company || company.active === false) {
    return {
      status: 404,
      body: { error: "El chat no está disponible en este momento." },
    };
  }

  const conversations = await readConversations();
  const conversation = conversations.find(
    (item) =>
      item.companyId === companyId &&
      item.conversationId === conversationId &&
      item.customerId === sessionId &&
      item.channel === "webchat",
  );

  if (!conversation || conversation.status !== "human_required") {
    return {
      status: 404,
      body: { error: "No encontramos una solicitud pendiente para estos datos." },
    };
  }

  const now = new Date().toISOString();
  conversation.customerName = lead.name;
  conversation.lead = {
    ...lead,
    capturedAt: now,
    source: "webchat",
  };
  conversation.summary = `${conversation.summary} · ${lead.name} · ${lead.city}`;
  conversation.lastMessageAt = now;
  conversation.messages.push({
    id: `web-contact-${randomUUID()}`,
    sender: "system",
    text: [
      "Datos del lead recibidos:",
      `Nombre: ${lead.name}`,
      `Teléfono: ${lead.phone}`,
      `Correo: ${lead.email}`,
      `Ciudad: ${lead.city}`,
      `Empresa: ${lead.company || "No indicada"}`,
    ].join("\n"),
    createdAt: now,
  });
  await saveConversations(conversations);

  return {
    status: 200,
    body: {
      ok: true,
      message: "Gracias. Tus datos quedaron registrados para el asesor.",
      whatsappUrl: buildWhatsAppUrl(company, conversation),
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
    conversation.lead
      ? [
          `Nombre: ${conversation.lead.name}`,
          `Teléfono: ${conversation.lead.phone}`,
          `Correo: ${conversation.lead.email}`,
          `Ciudad: ${conversation.lead.city}`,
          `Empresa: ${conversation.lead.company || "No indicada"}`,
          "",
        ].join("\n")
      : "",
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

function normalizePageContext(value) {
  const context = cleanText(value, 80).toLowerCase();
  if (context === "cardenas-romero") return "Cárdenas Romero Abogados asesoría jurídica";
  if (context === "src-consulting") return "SRC Consulting";
  return "";
}
