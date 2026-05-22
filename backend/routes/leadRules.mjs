import { readFile, writeFile } from "node:fs/promises";
import { ensureDataFile } from "../utils/dataPaths.mjs";

export const DEFAULT_LEAD_RULES = {
  requiredData: "Nombre, teléfono, empresa, canal de contacto y necesidad principal.",
  qualificationQuestions:
    "¿Qué necesitas automatizar? ¿Cuántos mensajes recibes al día? ¿Cuándo quieres implementar la solución?",
  hotLead: "Compra inmediata, solicita precio, pide demo, quiere agendar llamada o tiene urgencia.",
  warmLead: "Compara opciones, pregunta beneficios, está evaluando proveedores o quiere más información.",
  handoffRules: "Pasar a humano si pide negociación, descuento, soporte sensible, queja o cierre comercial.",
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

function normalizeRules(value = {}) {
  return {
    requiredData: String(value.requiredData || DEFAULT_LEAD_RULES.requiredData).trim(),
    qualificationQuestions: String(value.qualificationQuestions || DEFAULT_LEAD_RULES.qualificationQuestions).trim(),
    hotLead: String(value.hotLead || DEFAULT_LEAD_RULES.hotLead).trim(),
    warmLead: String(value.warmLead || DEFAULT_LEAD_RULES.warmLead).trim(),
    handoffRules: String(value.handoffRules || DEFAULT_LEAD_RULES.handoffRules).trim(),
  };
}
