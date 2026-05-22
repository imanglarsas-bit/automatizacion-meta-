import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../../utils/logger.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const companiesPath = join(dir, "../../data/companies.mock.json");

let cache = null;

async function loadCompanies() {
  if (cache) return cache;
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
  await writeFile(companiesPath, JSON.stringify(companies, null, 2));
  cache = companies;
  return company;
}
