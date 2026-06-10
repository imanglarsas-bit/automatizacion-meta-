import ExcelJS from "exceljs";
import { getAllCompanies } from "../company/companyConfigService.mjs";
import { getAllLeads, getCompanyLeads } from "../leads/leadService.mjs";

const stageLabels = {
  new: "Nuevo",
  contacted: "Contactado",
  qualified: "Calificado",
  proposal: "Propuesta",
  won: "Ganado",
  lost: "Perdido",
};

export async function buildLeadWorkbook({
  companyId = "all",
  stage = "all",
  search = "",
} = {}) {
  const companies = await getAllCompanies();
  const companyNames = new Map(companies.map((company) => [company.companyId, company.name]));
  const sourceLeads = companyId === "all"
    ? await getAllLeads()
    : await getCompanyLeads(companyId);
  const leads = filterLeads(sourceLeads, { stage, search, companyNames });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "iDIGITAL CRM";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = "Base comercial de clientes y oportunidades";

  addSummarySheet(workbook, leads, companyId, companyNames);
  addContactsSheet(workbook, leads, companyNames);

  return {
    buffer: await workbook.xlsx.writeBuffer(),
    filename: buildFilename(companyId, companyNames),
    count: leads.length,
  };
}

function addSummarySheet(workbook, leads, companyId, companyNames) {
  const sheet = workbook.addWorksheet("Resumen", {
    views: [{ showGridLines: false }],
  });
  const open = leads.filter((lead) => !["won", "lost"].includes(lead.salesStage || "new"));
  const won = leads.filter((lead) => lead.salesStage === "won");
  const lost = leads.filter((lead) => lead.salesStage === "lost");
  const openValue = open.reduce((sum, lead) => sum + (Number(lead.estimatedValue) || 0), 0);
  const wonValue = won.reduce((sum, lead) => sum + (Number(lead.estimatedValue) || 0), 0);
  const closed = won.length + lost.length;

  sheet.mergeCells("A1:D1");
  sheet.getCell("A1").value = "iDIGITAL | Base comercial";
  sheet.getCell("A1").style = titleStyle();
  sheet.getRow(1).height = 32;
  sheet.getCell("A2").value = "Empresa";
  sheet.getCell("B2").value = companyId === "all"
    ? "Todas las empresas"
    : companyNames.get(companyId) || companyId;
  sheet.getCell("A3").value = "Generado";
  sheet.getCell("B3").value = new Date();
  sheet.getCell("B3").numFmt = "dd/mm/yyyy hh:mm";

  sheet.getRow(5).values = [
    "Contactos",
    "Oportunidades abiertas",
    "Valor del pipeline",
    "Ventas ganadas",
  ];
  sheet.getRow(6).values = [leads.length, open.length, openValue, wonValue];
  sheet.getRow(5).eachCell((cell) => { cell.style = headerStyle(); });
  sheet.getRow(6).font = { bold: true, size: 14, color: { argb: "FF071B2D" } };
  sheet.getCell("C6").numFmt = '"$"#,##0';
  sheet.getCell("D6").numFmt = '"$"#,##0';

  sheet.getCell("A8").value = "Conversión";
  sheet.getCell("B8").value = closed ? won.length / closed : 0;
  sheet.getCell("B8").numFmt = "0%";
  sheet.getCell("A9").value = "Oportunidades perdidas";
  sheet.getCell("B9").value = lost.length;

  sheet.columns = [
    { width: 26 },
    { width: 24 },
    { width: 24 },
    { width: 24 },
  ];
}

function addContactsSheet(workbook, leads, companyNames) {
  const sheet = workbook.addWorksheet("Base de clientes", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });
  sheet.columns = [
    { header: "Empresa CRM", key: "crmCompany", width: 25 },
    { header: "Nombre", key: "name", width: 24 },
    { header: "Empresa / negocio", key: "business", width: 25 },
    { header: "Teléfono", key: "phone", width: 18 },
    { header: "Correo", key: "email", width: 30 },
    { header: "Ciudad", key: "city", width: 18 },
    { header: "Interés", key: "interest", width: 42 },
    { header: "Unidad", key: "unit", width: 21 },
    { header: "Etapa comercial", key: "salesStage", width: 18 },
    { header: "Valor estimado COP", key: "estimatedValue", width: 21 },
    { header: "Responsable", key: "owner", width: 22 },
    { header: "Próxima acción", key: "nextAction", width: 32 },
    { header: "Fecha seguimiento", key: "nextActionAt", width: 21 },
    { header: "Estado WhatsApp", key: "whatsappStatus", width: 20 },
    { header: "Origen", key: "source", width: 17 },
    { header: "Fecha captura", key: "capturedAt", width: 20 },
    { header: "Última actualización", key: "updatedAt", width: 20 },
    { header: "Notas comerciales", key: "notes", width: 44 },
    { header: "Autorizó datos", key: "consent", width: 16 },
    { header: "ID del lead", key: "leadId", width: 38 },
  ];
  sheet.autoFilter = "A1:T1";

  leads.forEach((lead) => {
    sheet.addRow({
      crmCompany: safeCell(companyNames.get(lead.companyId) || lead.companyId),
      name: safeCell(lead.name),
      business: safeCell(lead.business),
      phone: safeCell(lead.phone),
      email: safeCell(lead.email),
      city: safeCell(lead.city),
      interest: safeCell(lead.interest),
      unit: safeCell(lead.unit),
      salesStage: stageLabels[lead.salesStage || "new"] || "Nuevo",
      estimatedValue: Number(lead.estimatedValue) || 0,
      owner: safeCell(lead.owner),
      nextAction: safeCell(lead.nextAction),
      nextActionAt: excelDate(lead.nextActionAt),
      whatsappStatus: lead.status === "whatsapp_received" ? "Confirmado" : "Pendiente",
      source: sourceLabel(lead.source),
      capturedAt: excelDate(lead.capturedAt),
      updatedAt: excelDate(lead.updatedAt),
      notes: safeCell(lead.notes),
      consent: lead.consent ? "Sí" : "No",
      leadId: safeCell(lead.leadId),
    });
  });

  sheet.getRow(1).style = headerStyle();
  sheet.getRow(1).height = 28;
  sheet.getColumn("estimatedValue").numFmt = '"$"#,##0';
  ["nextActionAt", "capturedAt", "updatedAt"].forEach((key) => {
    sheet.getColumn(key).numFmt = "dd/mm/yyyy hh:mm";
  });
  sheet.eachRow((row, rowNumber) => {
    row.alignment = { vertical: "top", wrapText: rowNumber > 1 };
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F8FA" } };
    }
  });
}

function filterLeads(leads, { stage, search, companyNames }) {
  const query = String(search || "").trim().toLowerCase();
  return leads.filter((lead) => {
    if (stage !== "all" && (lead.salesStage || "new") !== stage) return false;
    if (!query) return true;
    return [
      lead.name,
      lead.business,
      lead.email,
      lead.phone,
      lead.city,
      lead.interest,
      lead.owner,
      companyNames.get(lead.companyId),
    ].join(" ").toLowerCase().includes(query);
  });
}

function buildFilename(companyId, companyNames) {
  const label = companyId === "all"
    ? "todas-las-empresas"
    : companyNames.get(companyId) || companyId;
  const date = new Date().toISOString().slice(0, 10);
  return `base-clientes-${slugify(label)}-${date}.xlsx`;
}

function sourceLabel(source) {
  const value = String(source || "").toLowerCase();
  if (value.includes("instagram")) return "Instagram";
  if (value.includes("facebook") || value.includes("messenger")) return "Facebook";
  if (value.includes("whatsapp")) return "WhatsApp";
  if (value.includes("form")) return "Formulario web";
  return "Chat web";
}

function excelDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeCell(value) {
  const text = String(value || "").trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function slugify(value) {
  return String(value || "clientes")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function titleStyle() {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF071B2D" } },
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 18 },
    alignment: { vertical: "middle" },
  };
}

function headerStyle() {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF071B2D" } },
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    alignment: { vertical: "middle", wrapText: true },
    border: {
      bottom: { style: "thin", color: { argb: "FF00AEEF" } },
    },
  };
}
