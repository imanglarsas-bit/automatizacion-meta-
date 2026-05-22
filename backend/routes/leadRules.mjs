import { readFile, writeFile } from "node:fs/promises";
import { ensureDataFile } from "../utils/dataPaths.mjs";

export const DEFAULT_LEAD_RULES = {
  requiredData: "Nombre, teléfono, empresa, canal de contacto y necesidad principal.",
  qualificationQuestions:
    "¿Qué necesitas automatizar? ¿Cuántos mensajes recibes al día? ¿Cuándo quieres implementar la solución?",
  hotLead: "Compra inmediata, solicita precio, pide demo, quiere agendar llamada o tiene urgencia.",
  warmLead: "Compara opciones, pregunta beneficios, está evaluando proveedores o quiere más información.",
  handoffRules: "Pasar a humano si pide negociación, descuento, soporte sensible, queja o cierre comercial.",
  funnels: [
    {
      id: "default-demo",
      name: "Solicitud de demo",
      trigger: "demo, asesoría, llamada, reunión, agendar",
      action: "human",
      priority: "alta",
      response: "Gracias. Te conecto con un asesor para coordinar la demo y avanzar con tu solicitud.",
    },
  ],
};

let rulesPath = null;

async function getRulesPath() {
  rulesPath = rulesPath || await ensureDataFile("lead-rules.mock.json");
  return rulesPath;
}

async function readRulesStore() {
  try {
    return JSON.parse(await readFile(await getRulesPath(), "utf8"));
  } catch {
    return {};
  }
}

async function writeRulesStore(store) {
  await writeFile(await getRulesPath(), JSON.stringify(store, null, 2));
}

export async function handleGetLeadRules(companyId) {
  const store = await readRulesStore();
  return {
    status: 200,
    body: {
      companyId,
      rules: normalizeRules(store[companyId]),
    },
  };
}

export async function handleSaveLeadRules(companyId, body) {
  const rules = normalizeRules(body);

  if (!rules.requiredData || !rules.qualificationQuestions || !rules.hotLead || !rules.warmLead || !rules.handoffRules) {
    return {
      status: 400,
      body: { error: "Todas las reglas de leads son obligatorias." },
    };
  }

  const store = await readRulesStore();
  store[companyId] = {
    ...rules,
    updatedAt: new Date().toISOString(),
  };
  await writeRulesStore(store);

  return {
    status: 200,
    body: {
      companyId,
      rules: store[companyId],
    },
  };
}

export async function getLeadRules(companyId) {
  const store = await readRulesStore();
  return normalizeRules(store[companyId]);
}

export async function evaluateLeadFunnel(companyId, message) {
  const rules = await getLeadRules(companyId);
  const normalizedMessage = normalizeText(message);
  const funnel = rules.funnels.find((item) => {
    const keywords = item.trigger
      .split(/[,;\n]+/)
      .map((keyword) => normalizeText(keyword).trim())
      .filter(Boolean);

    return keywords.some((keyword) => normalizedMessage.includes(keyword));
  });

  if (!funnel) {
    return null;
  }

  return {
    ...funnel,
    shouldHandoff: funnel.action === "human",
  };
}

function normalizeRules(value = {}) {
  return {
    requiredData: String(value.requiredData || DEFAULT_LEAD_RULES.requiredData).trim(),
    qualificationQuestions: String(value.qualificationQuestions || DEFAULT_LEAD_RULES.qualificationQuestions).trim(),
    hotLead: String(value.hotLead || DEFAULT_LEAD_RULES.hotLead).trim(),
    warmLead: String(value.warmLead || DEFAULT_LEAD_RULES.warmLead).trim(),
    handoffRules: String(value.handoffRules || DEFAULT_LEAD_RULES.handoffRules).trim(),
    funnels: normalizeFunnels(value.funnels),
  };
}

function normalizeFunnels(value) {
  const items = Array.isArray(value) ? value : DEFAULT_LEAD_RULES.funnels;

  return items
    .map((item, index) => ({
      id: String(item.id || `funnel-${Date.now()}-${index}`),
      name: String(item.name || "").trim(),
      trigger: String(item.trigger || "").trim(),
      action: item.action === "human" ? "human" : "auto",
      priority: ["alta", "media", "baja"].includes(item.priority) ? item.priority : "media",
      response: String(item.response || "").trim(),
    }))
    .filter((item) => item.name && item.trigger);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
