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
let sessionsPath = null;

async function getRulesPath() {
  rulesPath = rulesPath || await ensureDataFile("lead-rules.mock.json");
  return rulesPath;
}

async function getSessionsPath() {
  sessionsPath = sessionsPath || await ensureDataFile("lead-sessions.mock.json");
  return sessionsPath;
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

async function readSessionStore() {
  try {
    return JSON.parse(await readFile(await getSessionsPath(), "utf8"));
  } catch {
    return {};
  }
}

async function writeSessionStore(store) {
  await writeFile(await getSessionsPath(), JSON.stringify(store, null, 2));
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
  const funnel = findMatchingFunnel(rules.funnels, message, (item) => !item.options?.length);

  if (!funnel) {
    return null;
  }

  return {
    ...funnel,
    shouldHandoff: funnel.action === "human",
  };
}

export async function evaluateLeadMenu(companyId, senderId, message) {
  const rules = await getLeadRules(companyId);
  const sessions = await readSessionStore();
  const sessionKey = `${companyId}:${senderId || "anonymous"}`;
  const activeSession = sessions[sessionKey];
  const numericChoice = String(message || "").trim().match(/^\d+$/)?.[0];

  if (numericChoice && activeSession?.funnelId) {
    const activeFunnel = rules.funnels.find((item) => item.id === activeSession.funnelId);
    const option = activeFunnel?.options?.find((item) => String(item.number) === numericChoice);

    if (activeFunnel && option) {
      if (option.nextFunnelId) {
        const nextFunnel = rules.funnels.find((item) => item.id === option.nextFunnelId);
        if (nextFunnel?.options?.length) {
          sessions[sessionKey] = {
            companyId,
            senderId,
            funnelId: nextFunnel.id,
            createdAt: new Date().toISOString(),
          };
          await writeSessionStore(sessions);
          return {
            id: nextFunnel.id,
            optionId: option.id,
            shouldHandoff: false,
            text: `${option.response || "Perfecto, elige una opción:"}\n\n${formatMenuOptions(nextFunnel.options)}\n\nResponde solo con el número de la opción.`,
            provider: "lead-menu",
            model: `lead-menu:${activeFunnel.id}:${option.id}:next:${nextFunnel.id}`,
            estimatedCostUSD: 0,
          };
        }
      }

      delete sessions[sessionKey];
      await writeSessionStore(sessions);
      return {
        id: activeFunnel.id,
        optionId: option.id,
        shouldHandoff: option.action === "human",
        text: option.response || `Entendido. Seleccionaste: ${option.label}. Un asesor continuará el proceso.`,
        provider: "lead-menu",
        model: `lead-menu:${activeFunnel.id}:${option.id}`,
        estimatedCostUSD: 0,
      };
    }
  }

  const menu = findMatchingFunnel(rules.funnels, message, (item) => Boolean(item.options?.length));

  if (!menu) {
    return null;
  }

  sessions[sessionKey] = {
    companyId,
    senderId,
    funnelId: menu.id,
    createdAt: new Date().toISOString(),
  };
  await writeSessionStore(sessions);

  return {
    id: menu.id,
    shouldHandoff: false,
    text: `${menu.response || "Claro, elige una opción para dirigirte mejor:"}\n\n${formatMenuOptions(menu.options)}\n\nResponde solo con el número de la opción.`,
    provider: "lead-menu",
    model: `lead-menu:${menu.id}`,
    estimatedCostUSD: 0,
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
      options: normalizeOptions(item.options),
    }))
    .filter((item) => item.name && item.trigger);
}

function normalizeOptions(value) {
  const items = Array.isArray(value) ? value : [];

  return items
    .map((item, index) => ({
      id: String(item.id || `option-${index + 1}`),
      number: String(item.number || index + 1),
      label: String(item.label || "").trim(),
      action: item.action === "auto" ? "auto" : "human",
      response: String(item.response || "").trim(),
      nextFunnelId: item.nextFunnelId ? String(item.nextFunnelId) : "",
    }))
    .filter((item) => item.label);
}

function formatMenuOptions(options) {
  return options
    .map((option) => `${option.number}. ${option.label}`)
    .join("\n");
}

function findMatchingFunnel(funnels, message, filter = () => true) {
  const normalizedMessage = normalizeText(message);

  return funnels
    .filter(filter)
    .map((item) => {
      const matches = item.trigger
        .split(/[,;\n]+/)
        .map((keyword) => normalizeText(keyword).trim())
        .filter(Boolean)
        .filter((keyword) => normalizedMessage.includes(keyword));

      return {
        item,
        score: matches.length ? matches.length * 1000 + Math.max(...matches.map((keyword) => keyword.length)) : 0,
      };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item || null;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
