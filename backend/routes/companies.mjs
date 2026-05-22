// GET  /api/companies          — lista todas las empresas
// POST /api/companies          — crea empresa y usuario cliente
// GET  /api/companies/:id      — empresa por companyId
import { readFile, writeFile } from "node:fs/promises";
import { createCompany, getAllCompanies, getCompany } from "../services/company/companyConfigService.mjs";
import { getPlan, isValidPlan, listPlans, normalizePlanKey } from "../services/billing/plans.mjs";
import { ensureDataFile } from "../utils/dataPaths.mjs";

let usersPath = null;

async function getUsersPath() {
  usersPath = usersPath || await ensureDataFile("client-users.mock.json");
  return usersPath;
}

async function readUsers() {
  return JSON.parse(await readFile(await getUsersPath(), "utf8"));
}

async function writeUsers(users) {
  await writeFile(await getUsersPath(), JSON.stringify(users, null, 2));
}

export async function handleGetCompanies() {
  const companies = await getAllCompanies();
  return { status: 200, body: companies };
}

export async function handleGetCompany(companyId) {
  const company = await getCompany(companyId);
  if (!company) return { status: 404, body: { error: "Empresa no encontrada." } };
  return { status: 200, body: company };
}

export async function handleGetPlans() {
  return { status: 200, body: listPlans() };
}

export async function handleCreateCompany(body) {
  const name = String(body.name || "").trim();
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  const planKey = normalizePlanKey(body.plan);
  const website = String(body.website || "").trim();
  const email = String(body.email || "").trim();
  const whatsapp = String(body.whatsapp || "").trim();

  if (!name || !username || !password || !planKey) {
    return { status: 400, body: { error: "Nombre, usuario, contraseña y plan son obligatorios." } };
  }

  if (!isValidPlan(planKey)) {
    return { status: 400, body: { error: "El plan seleccionado no existe." } };
  }

  const plan = getPlan(planKey);
  const companyId = slugify(name);
  const users = await readUsers();
  if (users.some((user) => user.username === username)) {
    return { status: 409, body: { error: "Ya existe un usuario cliente con ese nombre." } };
  }

  const company = {
    companyId,
    name,
    active: true,
    plan: plan.key,
    monthlyConversationLimit: plan.monthlyConversationLimit,
    monthlyMessageLimit: plan.monthlyMessageLimit,
    monthlyAiRequestLimit: plan.monthlyAiRequestLimit,
    planFeatures: plan.features,
    currentUsage: 0,
    billingEnabled: false,
    aiProvider: plan.features.aiApi ? "anthropic" : null,
    model: "claude-3-5-sonnet-20241022",
    fallbackProvider: plan.features.aiApi ? "openai" : null,
    fallbackModel: "gpt-4o-mini",
    tone: "profesional",
    promptFile: "inversiones-manglar.txt",
    channels: plan.channels,
    units: [
      {
        id: "general",
        name: "Atención general",
        type: "general",
        contact: { whatsapp, email },
      },
    ],
    schedule: {
      timezone: "America/Bogota",
      hours: { open: "08:00", close: "18:00" },
      days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    },
    contact: { whatsapp, email, website },
  };

  const created = await createCompany(company);
  if (!created) {
    return { status: 409, body: { error: "Ya existe una empresa con ese nombre." } };
  }

  users.push({ username, password, companyId, name });
  await writeUsers(users);

  return {
    status: 201,
    body: {
      company,
      user: { username, companyId, name },
    },
  };
}

export async function handleGetClientUsers() {
  const users = await readUsers();
  return {
    status: 200,
    body: users.map(({ password, ...user }) => user),
  };
}

export async function handleDeleteClientUser(username) {
  const normalizedUsername = String(username || "").trim().toLowerCase();
  const users = await readUsers();
  const nextUsers = users.filter((user) => user.username !== normalizedUsername);

  if (nextUsers.length === users.length) {
    return {
      status: 404,
      body: { error: "Usuario cliente no encontrado." },
    };
  }

  await writeUsers(nextUsers);
  return {
    status: 200,
    body: { ok: true, username: normalizedUsername },
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
