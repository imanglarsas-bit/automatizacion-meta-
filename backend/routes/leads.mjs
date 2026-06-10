import {
  getAllLeads,
  getCompanyLeads,
  updateLead,
} from "../services/leads/leadService.mjs";

export async function handleGetLeads(companyId) {
  return {
    status: 200,
    body: {
      companyId,
      leads: await getCompanyLeads(companyId),
    },
  };
}

export async function handleGetAllLeads() {
  return {
    status: 200,
    body: {
      leads: await getAllLeads(),
    },
  };
}

export async function handleUpdateLead(companyId, leadId, body) {
  const lead = await updateLead(companyId, leadId, body || {});
  if (!lead) {
    return {
      status: 404,
      body: { error: "Lead no encontrado." },
    };
  }

  return {
    status: 200,
    body: { lead },
  };
}
