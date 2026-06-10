import { readFile, writeFile } from "node:fs/promises";
import { ensureDataFile } from "../../utils/dataPaths.mjs";

let leadsPath = null;
let conversationsPath = null;
let leadQueue = Promise.resolve();

async function getLeadsPath() {
  leadsPath = leadsPath || await ensureDataFile("leads.json");
  return leadsPath;
}

async function getConversationsPath() {
  conversationsPath = conversationsPath || await ensureDataFile("conversations.mock.json");
  return conversationsPath;
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function enqueue(operation) {
  const task = leadQueue.then(operation);
  leadQueue = task.catch(() => {});
  return task;
}

export function saveLeadFromWebChat({ conversation, lead }) {
  return enqueue(async () => {
    const leads = await readJson(await getLeadsPath(), []);
    const now = new Date().toISOString();
    const index = leads.findIndex((item) => item.leadId === conversation.conversationId);
    const record = {
      leadId: conversation.conversationId,
      companyId: conversation.companyId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      city: lead.city,
      business: lead.company || "",
      unit: conversation.unit,
      interest: conversation.summary,
      source: "webchat",
      status: "awaiting_whatsapp",
      consent: true,
      capturedAt: lead.capturedAt || now,
      updatedAt: now,
      whatsappReceivedAt: null,
      lastWhatsAppMessage: "",
    };

    if (index === -1) {
      leads.unshift(record);
    } else {
      leads[index] = { ...leads[index], ...record };
    }

    await writeFile(await getLeadsPath(), JSON.stringify(leads, null, 2));
    return record;
  });
}

export function getCompanyLeads(companyId) {
  return enqueue(async () => {
    const leads = await readJson(await getLeadsPath(), []);
    return leads
      .filter((lead) => lead.companyId === companyId)
      .sort((a, b) => new Date(b.updatedAt || b.capturedAt) - new Date(a.updatedAt || a.capturedAt));
  });
}

export function confirmLeadWhatsApp({ phone, message }) {
  return enqueue(async () => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return null;

    const leads = await readJson(await getLeadsPath(), []);
    const match = leads
      .filter((lead) => lead.status === "awaiting_whatsapp" && phonesMatch(lead.phone, normalizedPhone))
      .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt))[0];

    if (!match) return null;

    const now = new Date().toISOString();
    match.status = "whatsapp_received";
    match.whatsappReceivedAt = now;
    match.updatedAt = now;
    match.lastWhatsAppMessage = String(message || "").trim().slice(0, 1200);

    const conversations = await readJson(await getConversationsPath(), []);
    const remaining = conversations.filter(
      (conversation) =>
        !(
          conversation.companyId === match.companyId &&
          conversation.conversationId === match.leadId &&
          conversation.channel === "webchat"
        ),
    );

    await Promise.all([
      writeFile(await getLeadsPath(), JSON.stringify(leads, null, 2)),
      writeFile(await getConversationsPath(), JSON.stringify(remaining, null, 2)),
    ]);

    return match;
  });
}

function phonesMatch(first, second) {
  const a = normalizePhone(first);
  const b = normalizePhone(second);
  if (!a || !b) return false;
  return a === b || a.slice(-10) === b.slice(-10);
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}
