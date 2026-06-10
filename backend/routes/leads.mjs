import { getCompanyLeads } from "../services/leads/leadService.mjs";

export async function handleGetLeads(companyId) {
  return {
    status: 200,
    body: {
      companyId,
      leads: await getCompanyLeads(companyId),
    },
  };
}
