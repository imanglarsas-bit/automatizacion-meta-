import { readFile, writeFile } from "node:fs/promises";
import { ensureDataFile } from "../utils/dataPaths.mjs";

const DEFAULT_TRAINING = [
  {
    id: "default-price",
    question: "precio, costo, valor, plan",
    answer:
      "Tenemos planes según el volumen de mensajes y los canales que quieras conectar. ¿Cuántos mensajes reciben al día y cuál es tu canal principal?",
    category: "Ventas",
    channel: "Todos",
  },
  {
    id: "default-hours",
    question: "horario, atienden, abierto",
    answer:
      "Atendemos de lunes a viernes de 8:00 a. m. a 6:00 p. m. El bot puede recibir tus datos ahora y un asesor continuará el caso.",
    category: "Soporte",
    channel: "Todos",
  },
];

const DEFAULT_SETTINGS = {
  channels: {},
  metaConnections: {},
  training: DEFAULT_TRAINING,
  confidence: 75,
};

let settingsPath = null;

async function getSettingsPath() {
  settingsPath = settingsPath || await ensureDataFile("company-settings.mock.json");
  return settingsPath;
}

async function readStore() {
  try {
    return JSON.parse(await readFile(await getSettingsPath(), "utf8"));
  } catch {
    return {};
  }
}

async function writeStore(store) {
  await writeFile(await getSettingsPath(), JSON.stringify(store, null, 2));
}

export async function handleGetCompanySettings(companyId) {
  const store = await readStore();
  return {
    status: 200,
    body: {
      companyId,
      settings: normalizeSettings(store[companyId]),
    },
  };
}

export async function handleSaveCompanySettings(companyId, body) {
  const store = await readStore();
  const current = normalizeSettings(store[companyId]);
  const settings = normalizeSettings({
    ...current,
    ...body,
  });

  store[companyId] = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  await writeStore(store);
  return {
    status: 200,
    body: {
      companyId,
      settings: store[companyId],
    },
  };
}

function normalizeSettings(value = {}) {
  return {
    channels: normalizeChannels(value.channels),
    metaConnections: normalizeMetaConnections(value.metaConnections),
    training: normalizeTraining(value.training),
    confidence: normalizeConfidence(value.confidence),
  };
}

function normalizeChannels(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, enabled]) => [key, Boolean(enabled)]),
  );
}

function normalizeMetaConnections(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, connection]) => [
      key,
      {
        status: String(connection?.status || "pending"),
        code: connection?.code ? String(connection.code) : "",
        error: connection?.error ? String(connection.error) : "",
        connectedAt: connection?.connectedAt ? String(connection.connectedAt) : "",
        updatedAt: connection?.updatedAt ? String(connection.updatedAt) : "",
      },
    ]),
  );
}

function normalizeTraining(value) {
  const items = Array.isArray(value) ? value : DEFAULT_TRAINING;

  return items
    .map((item, index) => ({
      id: String(item.id || `training-${Date.now()}-${index}`),
      question: String(item.question || "").trim(),
      answer: String(item.answer || "").trim(),
      category: String(item.category || "General").trim(),
      channel: String(item.channel || "Todos").trim(),
    }))
    .filter((item) => item.question && item.answer);
}

function normalizeConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_SETTINGS.confidence;
  return Math.max(50, Math.min(95, Math.round(number)));
}
