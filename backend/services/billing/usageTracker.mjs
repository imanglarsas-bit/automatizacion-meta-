import { readFile, writeFile } from "node:fs/promises";
import { logger } from "../../utils/logger.mjs";
import { ensureDataFile } from "../../utils/dataPaths.mjs";

let usagePath = null;

async function getUsagePath() {
  usagePath = usagePath || await ensureDataFile("usage.mock.json");
  return usagePath;
}

async function readUsage() {
  try {
    return JSON.parse(await readFile(await getUsagePath(), "utf8"));
  } catch {
    return {};
  }
}

async function writeUsage(data) {
  await writeFile(await getUsagePath(), JSON.stringify(data, null, 2));
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export async function recordConversation({ companyId, channel, provider, model, estimatedCostUSD = 0 }) {
  const usage = await readUsage();
  const month = currentMonth();

  if (!usage[companyId]) {
    usage[companyId] = { month, conversations: 0, messages: 0, estimatedCostUSD: 0, byProvider: {}, byChannel: {}, daily: [] };
  }

  const co = usage[companyId];

  // Reset if new month
  if (co.month !== month) {
    co.month = month;
    co.conversations = 0;
    co.messages = 0;
    co.estimatedCostUSD = 0;
    co.byProvider = {};
    co.byChannel = {};
    co.daily = [];
  }

  co.conversations++;
  co.messages++;
  co.estimatedCostUSD = +(co.estimatedCostUSD + estimatedCostUSD).toFixed(6);

  co.byProvider[provider] = co.byProvider[provider] ?? { calls: 0, estimatedCostUSD: 0 };
  co.byProvider[provider].calls++;
  co.byProvider[provider].estimatedCostUSD = +(co.byProvider[provider].estimatedCostUSD + estimatedCostUSD).toFixed(6);

  co.byChannel[channel] = (co.byChannel[channel] ?? 0) + 1;

  const today = new Date().toISOString().slice(0, 10);
  const dayEntry = co.daily.find((d) => d.date === today);
  if (dayEntry) {
    dayEntry.messages++;
  } else {
    co.daily.push({ date: today, messages: 1 });
  }

  try {
    await writeUsage(usage);
  } catch (err) {
    logger.error("Error writing usage", { error: err.message });
  }

  return co;
}

export async function getUsage(companyId) {
  const usage = await readUsage();
  return usage[companyId] ?? null;
}
