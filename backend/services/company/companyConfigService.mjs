import { readFile, writeFile } from "node:fs/promises";
import { logger } from "../../utils/logger.mjs";
import { ensureDataFile } from "../../utils/dataPaths.mjs";

let cache = null;
let companiesPath = null;

async function loadCompanies() {
  if (cache) return cache;
  companiesPath = companiesPath || await ensureDataFile("companies.mock.json");
  const raw = await readFile(companiesPath, "utf8");
  cache = JSON.parse(raw);
  return cache;
}

export async function getCompany(companyId) {
  const companies = await loadCompanies();
  const company = companies.find((c) => c.companyId === companyId);
  if (!company) {
    logger.warn("Company not found", { companyId });
    return null;
  }
  return company;
}

export async function getAllCompanies() {
  return loadCompanies();
}

export async function getActiveCompanies() {
  const companies = await loadCompanies();
  return companies.filter((c) => c.active);
}

export function invalidateCache() {
  cache = null;
}

export async function createCompany(company) {
  const companies = await loadCompanies();
  if (companies.some((item) => item.companyId === company.companyId)) {
    return null;
  }

  companies.push(company);
  companiesPath = companiesPath || await ensureDataFile("companies.mock.json");
  await writeFile(companiesPath, JSON.stringify(companies, null, 2));
  cache = companies;
  return company;
}

export async function updateCompanyPlan(companyId, planData) {
  const companies = await loadCompanies();
  const idx = companies.findIndex((c) => c.companyId === companyId);
  if (idx === -1) return null;

  const current = companies[idx];
  companies[idx] = {
    ...current,
    plan: planData.key,
    monthlyMessageLimit: planData.monthlyMessageLimit,
    monthlyConversationLimit: planData.monthlyConversationLimit,
    monthlyAiRequestLimit: planData.monthlyAiRequestLimit,
    planFeatures: planData.features,
    aiProvider: planData.features?.aiApi ? (current.aiProvider || "anthropic") : null,
    fallbackProvider: planData.features?.aiApi ? (current.fallbackProvider || "openai") : null,
    channels: planData.channels || current.channels,
    planUpdatedAt: new Date().toISOString(),
  };

  companiesPath = companiesPath || await ensureDataFile("companies.mock.json");
  await writeFile(companiesPath, JSON.stringify(companies, null, 2));
  cache = companies;
  return companies[idx];
}

export async function updateCompanyMeta(companyId, metaData) {
  const companies = await loadCompanies();
  const idx = companies.findIndex((c) => c.companyId === companyId);
  if (idx === -1) return null;

  const current = companies[idx];
  companies[idx] = {
    ...current,
    meta: {
      ...(current.meta || {}),
      whatsappPhoneNumberIds: normalizeIdList(metaData.whatsappPhoneNumberIds),
      instagramAccountIds: normalizeIdList(metaData.instagramAccountIds),
      facebookPageIds: normalizeIdList(metaData.facebookPageIds),
    },
    metaUpdatedAt: new Date().toISOString(),
  };

  companiesPath = companiesPath || await ensureDataFile("companies.mock.json");
  await writeFile(companiesPath, JSON.stringify(companies, null, 2));
  cache = companies;
  return companies[idx];
}

function normalizeIdList(value) {
  const items = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[,;\n]+/);

  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
}
