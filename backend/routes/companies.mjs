// GET /api/companies          — lista todas las empresas
// GET /api/companies/:id      — empresa por companyId
import { getAllCompanies, getCompany } from "../services/company/companyConfigService.mjs";

export async function handleGetCompanies() {
  const companies = await getAllCompanies();
  return { status: 200, body: companies };
}

export async function handleGetCompany(companyId) {
  const company = await getCompany(companyId);
  if (!company) return { status: 404, body: { error: "Empresa no encontrada." } };
  return { status: 200, body: company };
}
