// Support chat routes (internal: client ↔ admin)
// GET  /api/support            — admin: all tickets
// GET  /api/support/client     — client: own ticket (uses session companyId)
// POST /api/support/message    — client sends a message
// POST /api/support/:id/reply  — admin replies

import { readFile, writeFile } from "node:fs/promises";
import { ensureDataFile } from "../utils/dataPaths.mjs";

let supportPath = null;

async function getPath() {
  supportPath = supportPath || await ensureDataFile("support.json");
  return supportPath;
}

async function readTickets() {
  try {
    return JSON.parse(await readFile(await getPath(), "utf8"));
  } catch {
    return [];
  }
}

async function saveTickets(tickets) {
  await writeFile(await getPath(), JSON.stringify(tickets, null, 2));
}

function makeId() {
  return `sup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function handleGetAllTickets() {
  const tickets = await readTickets();
  return { status: 200, body: tickets };
}

export async function handleGetClientTicket(companyId) {
  const tickets = await readTickets();
  const ticket = tickets.find((t) => t.companyId === companyId) || null;
  return { status: 200, body: ticket };
}

export async function handleClientMessage(companyId, companyName, body) {
  const text = String(body.text || "").trim();
  if (!text) {
    return { status: 400, body: { error: "El mensaje no puede estar vacío." } };
  }

  const tickets = await readTickets();
  let ticket = tickets.find((t) => t.companyId === companyId);

  const message = { id: makeId(), sender: "client", text, at: new Date().toISOString() };

  if (!ticket) {
    ticket = {
      id: makeId(),
      companyId,
      companyName: companyName || companyId,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [message],
    };
    tickets.unshift(ticket);
  } else {
    ticket.messages.push(message);
    ticket.status = "open";
    ticket.updatedAt = new Date().toISOString();
  }

  await saveTickets(tickets);
  return { status: 200, body: ticket };
}

export async function handleAdminReply(companyId, body) {
  const text = String(body.text || "").trim();
  if (!text) {
    return { status: 400, body: { error: "La respuesta no puede estar vacía." } };
  }

  const tickets = await readTickets();
  const ticket = tickets.find((t) => t.companyId === companyId);

  if (!ticket) {
    return { status: 404, body: { error: "No hay conversación de soporte para este cliente." } };
  }

  ticket.messages.push({ id: makeId(), sender: "admin", text, at: new Date().toISOString() });
  ticket.status = "answered";
  ticket.updatedAt = new Date().toISOString();

  await saveTickets(tickets);
  return { status: 200, body: ticket };
}
