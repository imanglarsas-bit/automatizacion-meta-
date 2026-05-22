// GET  /api/companies          — lista todas las empresas
// POST /api/companies          — crea empresa y usuario cliente
// GET  /api/companies/:id      — empresa por companyId
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCompany, getAllCompanies, getCompany } from "../services/company/companyConfigService.mjs";

const dataDir = fileURLToPath(new URL("../data/", import.meta.url));
const usersPath = join(dataDir, "client-users.mock.json");

export async function handleGetCompanies() {
  const companies = await getAllCompanies();
  return { status: 200, body: companies };
}

export async function handleGetCompany(companyId) {
  const company = await getCompany(companyId);
  if (!company) return { status: 404, body: { error: "Empresa no encontrada." } };
  return { status: 200, body: company };
}

export async function handleCreateCompany(body) {
  const name = String(body.name || "").trim();
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  const website = String(body.website || "").trim();
  const email = String(body.email || "").trim();
  const whatsapp = String(body.whatsapp || "").trim();

  if (!name || !username || !password) {
    return { status: 400, body: { error: "Nombre, usuario y contraseña son obligatorios." } };
  }

  const companyId = slugify(name);
  const company = {
    companyId,
    name,
    active: true,
    plan: "business",
    monthlyConversationLimit: 500,
    currentUsage: 0,
    billingEnabled: false,
    aiProvider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o-mini",
    tone: "profesional",
    promptFile: "inversiones-manglar.txt",
    channels: ["whatsapp"],
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

  const users = JSON.parse(await readFile(usersPath, "utf8"));
  if (users.some((user) => user.username === username)) {
    return { status: 409, body: { error: "Ya existe un usuario cliente con ese nombre." } };
  }

  users.push({ username, password, companyId, name });
  await writeFile(usersPath, JSON.stringify(users, null, 2));

  return {
    status: 201,
    body: {
      company,
      user: { username, companyId, name },
    },
  };
}

export async function handleGetClientUsers() {
  const users = JSON.parse(await readFile(usersPath, "utf8"));
  return {
    status: 200,
    body: users.map(({ password, ...user }) => user),
  };
}

export async function handleDeleteClientUser(username) {
  const normalizedUsername = String(username || "").trim().toLowerCase();
  const users = JSON.parse(await readFile(usersPath, "utf8"));
  const nextUsers = users.filter((user) => user.username !== normalizedUsername);

  if (nextUsers.length === users.length) {
    return {
      status: 404,
      body: { error: "Usuario cliente no encontrado." },
    };
  }

  await writeFile(usersPath, JSON.stringify(nextUsers, null, 2));
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
