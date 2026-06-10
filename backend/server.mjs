import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

// ── SaaS layer (non-destructive additions) ───────────────────────────────────
import { handleSendMetaTest, handleTestMessage }      from "./routes/testRoutes.mjs";
import {
  handleCreateCompany,
  handleDeleteClientUser,
  handleGetClientUsers,
  handleGetCompanies,
  handleGetCompany,
  handleResetClientUserPassword,
  handleUpdateCompanyMeta,
  handleUpdateCompanyPlan,
} from "./routes/companies.mjs";
import { handleGetPlans, handleUpdatePlan } from "./routes/plans.mjs";
import { handleGetMetrics }       from "./routes/metrics.mjs";
import { handleGetCompanySettings, handleSaveCompanySettings } from "./routes/companySettings.mjs";
import { handleGetLeadRules, handleSaveLeadRules } from "./routes/leadRules.mjs";
import { handleGetConversations } from "./routes/conversations.mjs";
import { handleGetAllLeads, handleGetLeads, handleUpdateLead } from "./routes/leads.mjs";
import { handleGetMessages, handleReplyToConversation } from "./routes/messages.mjs";
import { handleGetMetaConnectUrl, handleMetaOAuthCallback } from "./routes/metaConnect.mjs";
import { handleWebChatContact, handleWebChatMessage } from "./routes/webChat.mjs";
import {
  handleGetAllTickets,
  handleGetClientTicket,
  handleClientMessage,
  handleAdminReply,
} from "./routes/support.mjs";
import { handleWebhookVerification as saasWebhookVerify,
         handleWebhookEvent as saasWebhookEvent } from "./routes/metaWebhook.mjs";
import { ensureDataFile } from "./utils/dataPaths.mjs";
import { confirmLeadWhatsApp } from "./services/leads/leadService.mjs";
// ─────────────────────────────────────────────────────────────────────────────

const root = join(fileURLToPath(new URL("..", import.meta.url)));
let trainingPath = null;
let clientUsersPath = null;

const env = {
  port: Number(process.env.PORT || 3000),
  verifyToken: process.env.META_VERIFY_TOKEN || "dev_verify_token",
  graphVersion: process.env.GRAPH_API_VERSION || "v22.0",
  whatsappToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  pageAccessToken: process.env.PAGE_ACCESS_TOKEN || "",
  platformPassword: process.env.PLATFORM_PASSWORD || "dev_admin",
  adminPassword: process.env.ADMIN_PASSWORD || process.env.PLATFORM_PASSWORD || "dev_admin",
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const privatePaths = new Set([
  "/plataforma.html",
  "/platform.css",
  "/platform.js",
  "/cliente.html",
  "/client.css",
  "/client.js",
]);
const webChatRateLimits = new Map();
const webChatOrigins = new Set([
  "https://imanglar.com",
  "https://www.imanglar.com",
  "https://app.imanglar.com",
  "http://localhost:3000",
  "http://localhost:3003",
]);

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter((pair) => pair.length === 2),
  );
}

function sessionRole(request) {
  return parseCookies(request).r360_session?.split(":")[0] || "";
}

function sessionCompanyId(request) {
  const cookie = parseCookies(request).r360_session || "";
  const [, companyId] = cookie.split(":");
  return companyId || "";
}

function isClientAuthenticated(request) {
  return sessionRole(request) === "client";
}

function isAdminAuthenticated(request) {
  return sessionRole(request) === "admin";
}

function hasPlatformSession(request) {
  const role = sessionRole(request);
  return role === "client" || role === "admin";
}

function isSecureRequest(request) {
  const host = request.headers.host || "";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("[::1]");
  return request.headers["x-forwarded-proto"] === "https" || !isLocalhost;
}

function redirect(response, location) {
  response.writeHead(302, { Location: location });
  response.end();
}

function sendLoginCookie(request, response, role, location) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  response.writeHead(302, {
    Location: location,
    "Set-Cookie": `r360_session=${role}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure}`,
  });
  response.end();
}

function sendLogoutCookie(request, response) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  response.writeHead(302, {
    Location: "/login.html",
    "Set-Cookie": `r360_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  });
  response.end();
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendPublicJson(request, response, status, payload) {
  const origin = request.headers.origin || "";
  const corsOrigin = webChatOrigins.has(origin) ? origin : "https://imanglar.com";

  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  });
  response.end(status === 204 ? "" : JSON.stringify(payload));
}

function isAllowedWebChatRequest(request) {
  const origin = request.headers.origin || "";
  return !origin || webChatOrigins.has(origin);
}

function consumeWebChatRateLimit(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const key = forwarded || request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = webChatRateLimits.get(key);

  if (!current || now - current.startedAt > 60_000) {
    webChatRateLimits.set(key, { startedAt: now, count: 1 });
    return true;
  }

  current.count += 1;
  return current.count <= 30;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function readRawBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function handleLogin(request, response) {
  const raw = await readRawBody(request);
  const form = new URLSearchParams(raw);
  const username = form.get("username")?.trim().toLowerCase();
  const password = form.get("password")?.trim();

  clientUsersPath = clientUsersPath || await ensureDataFile("client-users.mock.json");
  const users = JSON.parse(await readFile(clientUsersPath, "utf8"));
  const user = users.find((item) => item.username === username && item.password === password);

  if (user) {
    sendLoginCookie(request, response, `client:${user.companyId}`, "/cliente.html");
    return;
  }

  redirect(response, "/login.html?error=1");
}

async function handleAdminLogin(request, response) {
  const raw = await readRawBody(request);
  const form = new URLSearchParams(raw);
  const password = form.get("password")?.trim();

  if (password === env.adminPassword) {
    sendLoginCookie(request, response, "admin", "/plataforma.html");
    return;
  }

  redirect(response, "/admin-login.html?error=1");
}

async function readTraining() {
  trainingPath = trainingPath || await ensureDataFile("training.json");
  if (!existsSync(trainingPath)) {
    return [];
  }

  return JSON.parse(await readFile(trainingPath, "utf8"));
}

async function saveTraining(items) {
  trainingPath = trainingPath || await ensureDataFile("training.json");
  await writeFile(trainingPath, JSON.stringify(items, null, 2));
}

function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findBestAnswer(message, training) {
  const messageWords = normalizeText(message).split(/\W+/).filter(Boolean);
  const ranked = training
    .map((item) => {
      const questionWords = normalizeText(item.question).split(/\W+/).filter(Boolean);
      const score = questionWords.filter((word) => messageWords.includes(word)).length;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.score > 0 ? ranked[0].item : null;
}

function extractWhatsAppMessage(payload) {
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  if (!message?.text?.body) {
    return null;
  }

  return {
    channel: "whatsapp",
    senderId: message.from,
    text: message.text.body,
    phoneNumberId: value.metadata?.phone_number_id,
  };
}

function extractMessengerMessage(payload) {
  const messaging = payload.entry?.[0]?.messaging?.[0];
  const text = messaging?.message?.text;

  if (!text) {
    return null;
  }

  return {
    channel: payload.object === "instagram" ? "instagram" : "messenger",
    senderId: messaging.sender?.id,
    text,
  };
}

function extractIncomingMessage(payload) {
  return extractWhatsAppMessage(payload) || extractMessengerMessage(payload);
}

async function sendWhatsAppText(to, text, phoneNumberId = env.whatsappPhoneNumberId) {
  if (!env.whatsappToken || !phoneNumberId) {
    return { skipped: true, reason: "Missing WhatsApp token or phone number id." };
  }

  const response = await fetch(
    `https://graph.facebook.com/${env.graphVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    },
  );

  return response.json();
}

async function sendMessengerText(recipientId, text) {
  if (!env.pageAccessToken) {
    return { skipped: true, reason: "Missing Page access token." };
  }

  const response = await fetch(
    `https://graph.facebook.com/${env.graphVersion}/me/messages?access_token=${env.pageAccessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    },
  );

  return response.json();
}

async function respondToIncomingMessage(incoming) {
  const training = await readTraining();
  const match = findBestAnswer(incoming.text, training);
  const reply = match
    ? match.answer
    : "Gracias por escribirnos. Ya recibimos tu mensaje y un asesor lo revisará en breve.";

  if (incoming.channel === "whatsapp") {
    return sendWhatsAppText(incoming.senderId, reply, incoming.phoneNumberId);
  }

  return sendMessengerText(incoming.senderId, reply);
}

async function handleWebhookVerification(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.verifyToken) {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end(challenge);
    return;
  }

  response.writeHead(403);
  response.end("Verification failed");
}

async function handleWebhookEvent(request, response) {
  const payload = await readBody(request);
  const incoming = extractIncomingMessage(payload);

  if (incoming) {
    if (incoming.channel === "whatsapp") {
      await confirmLeadWhatsApp({ phone: incoming.senderId, message: incoming.text });
    }
    await respondToIncomingMessage(incoming);
  }

  sendJson(response, 200, { ok: true, received: Boolean(incoming) });
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (!url.pathname.startsWith("/api/")) {
    return false;
  }

  if (!hasPlatformSession(request)) {
    sendJson(response, 401, { error: "Authentication required" });
    return true;
  }

  const role = sessionRole(request);
  const companyId = sessionCompanyId(request);

  if (request.method === "GET" && url.pathname === "/api/session") {
    sendJson(response, 200, { role, companyId });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/training") {
    sendJson(response, 200, await readTraining());
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/training") {
    const body = await readBody(request);
    const training = await readTraining();
    const nextItem = {
      id: `server-${Date.now()}`,
      question: String(body.question || "").trim(),
      answer: String(body.answer || "").trim(),
      category: body.category || "General",
      channel: body.channel || "Todos",
    };

    if (!nextItem.question || !nextItem.answer) {
      sendJson(response, 400, { error: "question and answer are required" });
      return true;
    }

    await saveTraining([nextItem, ...training]);
    sendJson(response, 201, nextItem);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/test") {
    const body = await readBody(request);
    const match = findBestAnswer(body.message || "", await readTraining());
    sendJson(response, 200, {
      answer:
        match?.answer ||
        "No encontré una respuesta entrenada. Este caso debería derivarse a un asesor.",
      matched: Boolean(match),
    });
    return true;
  }

  // ── SaaS routes ─────────────────────────────────────────────────────────────

  if (request.method === "POST" && url.pathname === "/api/test-message") {
    const body = await readBody(request);
    if (role === "client" && body.companyId !== companyId) {
      sendJson(response, 403, { error: "No puedes probar otra empresa." });
      return true;
    }

    const result = await handleTestMessage(body);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/meta/send-test") {
    if (role !== "admin") {
      sendJson(response, 403, { error: "Admin required" });
      return true;
    }

    const body = await readBody(request);
    const result = await handleSendMetaTest(body);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/companies") {
    if (role === "client") {
      const result = await handleGetCompany(companyId);
      sendJson(response, result.status, result.status === 200 ? [result.body] : result.body);
      return true;
    }

    const result = await handleGetCompanies();
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/plans") {
    const result = await handleGetPlans();
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/meta/connect-url") {
    if (role !== "admin") {
      sendJson(response, 403, { error: "Admin required" });
      return true;
    }

    const result = handleGetMetaConnectUrl(url);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (url.pathname.startsWith("/api/company-settings/")) {
    const requestedCompanyId = decodeURIComponent(url.pathname.replace("/api/company-settings/", ""));
    if (role === "client" && requestedCompanyId !== companyId) {
      sendJson(response, 403, { error: "No puedes acceder a configuraciones de otra empresa." });
      return true;
    }

    if (request.method === "GET") {
      const result = await handleGetCompanySettings(requestedCompanyId);
      sendJson(response, result.status, result.body);
      return true;
    }

    if (request.method === "PUT") {
      if (role !== "admin") {
        sendJson(response, 403, { error: "Admin required" });
        return true;
      }

      const body = await readBody(request);
      const result = await handleSaveCompanySettings(requestedCompanyId, body);
      sendJson(response, result.status, result.body);
      return true;
    }
  }

  if (request.method === "PUT" && url.pathname.startsWith("/api/plans/")) {
    if (role !== "admin") {
      sendJson(response, 403, { error: "Admin required" });
      return true;
    }
    const planKey = url.pathname.replace("/api/plans/", "");
    const body = await readBody(request);
    const result = await handleUpdatePlan(planKey, body);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (url.pathname.startsWith("/api/lead-rules/")) {
    const requestedCompanyId = decodeURIComponent(url.pathname.replace("/api/lead-rules/", ""));
    if (role === "client" && requestedCompanyId !== companyId) {
      sendJson(response, 403, { error: "No puedes acceder a reglas de otra empresa." });
      return true;
    }

    if (request.method === "GET") {
      const result = await handleGetLeadRules(requestedCompanyId);
      sendJson(response, result.status, result.body);
      return true;
    }

    if (request.method === "PUT") {
      if (role !== "admin") {
        sendJson(response, 403, { error: "Admin required" });
        return true;
      }

      const body = await readBody(request);
      const result = await handleSaveLeadRules(requestedCompanyId, body);
      sendJson(response, result.status, result.body);
      return true;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/client-users") {
    if (role !== "admin") {
      sendJson(response, 403, { error: "Admin required" });
      return true;
    }

    const result = await handleGetClientUsers();
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/client-users/")) {
    if (role !== "admin") {
      sendJson(response, 403, { error: "Admin required" });
      return true;
    }

    const username = decodeURIComponent(url.pathname.replace("/api/client-users/", ""));
    const result = await handleDeleteClientUser(username);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "PUT" && url.pathname.startsWith("/api/client-users/") && url.pathname.endsWith("/password")) {
    if (role !== "admin") {
      sendJson(response, 403, { error: "Admin required" });
      return true;
    }

    const username = decodeURIComponent(url.pathname.replace("/api/client-users/", "").replace("/password", ""));
    const body = await readBody(request);
    const result = await handleResetClientUserPassword(username, body);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/companies") {
    if (role !== "admin") {
      sendJson(response, 403, { error: "Admin required" });
      return true;
    }

    const body = await readBody(request);
    const result = await handleCreateCompany(body);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "PUT" && url.pathname.startsWith("/api/companies/") && url.pathname.endsWith("/plan")) {
    if (role !== "admin") {
      sendJson(response, 403, { error: "Admin required" });
      return true;
    }
    const companyId = url.pathname.replace("/api/companies/", "").replace("/plan", "");
    const body = await readBody(request);
    const result = await handleUpdateCompanyPlan(companyId, body);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "PUT" && url.pathname.startsWith("/api/companies/") && url.pathname.endsWith("/meta")) {
    if (role !== "admin") {
      sendJson(response, 403, { error: "Admin required" });
      return true;
    }
    const targetCompanyId = url.pathname.replace("/api/companies/", "").replace("/meta", "");
    const body = await readBody(request);
    const result = await handleUpdateCompanyMeta(targetCompanyId, body);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/companies/")) {
    const requestedCompanyId = url.pathname.replace("/api/companies/", "");
    if (role === "client" && requestedCompanyId !== companyId) {
      sendJson(response, 403, { error: "No puedes ver otra empresa." });
      return true;
    }
    const result = await handleGetCompany(requestedCompanyId);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/metrics/company/")) {
    const requestedCompanyId = url.pathname.replace("/api/metrics/company/", "");
    if (role === "client" && requestedCompanyId !== companyId) {
      sendJson(response, 403, { error: "No puedes ver métricas de otra empresa." });
      return true;
    }

    const result = await handleGetMetrics(requestedCompanyId);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/conversations/")) {
    const requestedCompanyId = url.pathname.replace("/api/conversations/", "");
    if (role === "client" && requestedCompanyId !== companyId) {
      sendJson(response, 403, { error: "No puedes ver otra empresa." });
      return true;
    }

    const result = await handleGetConversations(requestedCompanyId);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/leads") {
    if (role !== "admin") {
      sendJson(response, 403, { error: "Admin required" });
      return true;
    }

    const result = await handleGetAllLeads();
    sendJson(response, result.status, result.body);
    return true;
  }

  if (url.pathname.startsWith("/api/leads/")) {
    const leadParts = url.pathname.replace("/api/leads/", "").split("/").map(decodeURIComponent);
    const requestedCompanyId = leadParts[0];
    if (role === "client" && requestedCompanyId !== companyId) {
      sendJson(response, 403, { error: "No puedes ver leads de otra empresa." });
      return true;
    }

    if (request.method === "GET" && leadParts.length === 1) {
      const result = await handleGetLeads(requestedCompanyId);
      sendJson(response, result.status, result.body);
      return true;
    }

    if (request.method === "PATCH" && leadParts.length === 2) {
      const body = await readBody(request);
      const result = await handleUpdateLead(requestedCompanyId, leadParts[1], body);
      sendJson(response, result.status, result.body);
      return true;
    }
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/messages/")) {
    const parts = url.pathname.replace("/api/messages/", "").split("/");
    if (role === "client" && parts[0] !== companyId) {
      sendJson(response, 403, { error: "No puedes ver otra empresa." });
      return true;
    }

    const result = await handleGetMessages(parts[0], parts[1]);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "POST" && url.pathname.startsWith("/api/messages/")) {
    const parts = url.pathname.replace("/api/messages/", "").split("/");
    if (parts[2] === "reply") {
      if (role === "client" && parts[0] !== companyId) {
        sendJson(response, 403, { error: "No puedes responder otra empresa." });
        return true;
      }

      const body = await readBody(request);
      const result = await handleReplyToConversation(parts[0], parts[1], body);
      sendJson(response, result.status, result.body);
      return true;
    }
  }

  // ── Support chat (client ↔ admin) ────────────────────────────────────────────

  if (request.method === "GET" && url.pathname === "/api/support") {
    if (role !== "admin") {
      sendJson(response, 403, { error: "Admin required" });
      return true;
    }
    const result = await handleGetAllTickets();
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/support/client") {
    if (role !== "client") {
      sendJson(response, 403, { error: "Client session required" });
      return true;
    }
    const result = await handleGetClientTicket(companyId);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/support/message") {
    if (role !== "client") {
      sendJson(response, 403, { error: "Client session required" });
      return true;
    }
    const body = await readBody(request);
    const companies = (await import("./routes/companies.mjs").then((m) => m.handleGetCompany(companyId))).body;
    const companyName = companies?.name || companyId;
    const result = await handleClientMessage(companyId, companyName, body);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "POST" && url.pathname.startsWith("/api/support/") && url.pathname.endsWith("/reply")) {
    if (role !== "admin") {
      sendJson(response, 403, { error: "Admin required" });
      return true;
    }
    const targetCompanyId = decodeURIComponent(url.pathname.replace("/api/support/", "").replace("/reply", ""));
    const body = await readBody(request);
    const result = await handleAdminReply(targetCompanyId, body);
    sendJson(response, result.status, result.body);
    return true;
  }

  // ────────────────────────────────────────────────────────────────────────────

  return false;
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;

  if (requestedPath === "/plataforma.html" && !isAdminAuthenticated(request)) {
    redirect(response, "/admin-login.html");
    return;
  }

  if ((requestedPath === "/cliente.html" || requestedPath === "/client.css" || requestedPath === "/client.js") && !isClientAuthenticated(request)) {
    redirect(response, "/login.html");
    return;
  }

  if ((requestedPath === "/platform.css" || requestedPath === "/platform.js") && !isAdminAuthenticated(request)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (privatePaths.has(requestedPath) && !hasPlatformSession(request)) {
    redirect(response, "/login.html");
    return;
  }

  const safePath = normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
    });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "idigital-platform",
        uptime: Math.round(process.uptime()),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/privacy-policy") {
      const file = await readFile(join(root, "privacy.html"));
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(file);
      return;
    }

    if (url.pathname.startsWith("/api/web-chat/") && request.method === "OPTIONS") {
      if (!isAllowedWebChatRequest(request)) {
        sendPublicJson(request, response, 403, { error: "Origen no permitido." });
        return;
      }
      sendPublicJson(request, response, 204, {});
      return;
    }

    if (url.pathname === "/api/web-chat/message" && request.method === "POST") {
      if (!isAllowedWebChatRequest(request)) {
        sendPublicJson(request, response, 403, { error: "Origen no permitido." });
        return;
      }
      if (!consumeWebChatRateLimit(request)) {
        sendPublicJson(request, response, 429, { error: "Espera un momento antes de enviar más mensajes." });
        return;
      }
      const body = await readBody(request);
      const result = await handleWebChatMessage(body);
      sendPublicJson(request, response, result.status, result.body);
      return;
    }

    if (url.pathname === "/api/web-chat/contact" && request.method === "POST") {
      if (!isAllowedWebChatRequest(request)) {
        sendPublicJson(request, response, 403, { error: "Origen no permitido." });
        return;
      }
      if (!consumeWebChatRateLimit(request)) {
        sendPublicJson(request, response, 429, { error: "Espera un momento antes de enviar más mensajes." });
        return;
      }
      const body = await readBody(request);
      const result = await handleWebChatContact(body);
      sendPublicJson(request, response, result.status, result.body);
      return;
    }

    if (request.method === "GET" && url.pathname === "/webhooks/meta") {
      await handleWebhookVerification(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/webhooks/meta") {
      await handleWebhookEvent(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/login") {
      await handleLogin(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/admin-login") {
      await handleAdminLogin(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/logout") {
      sendLogoutCookie(request, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/meta/oauth/callback") {
      const result = await handleMetaOAuthCallback(url);
      response.writeHead(result.status, { "Content-Type": "text/html; charset=utf-8" });
      response.end(result.body);
      return;
    }

    // ── SaaS webhook path (/webhook/meta) ─────────────────────────────────────
    if (request.method === "GET" && url.pathname === "/webhook/meta") {
      const result = saasWebhookVerify(url);
      if (result.raw) {
        response.writeHead(result.status, { "Content-Type": "text/plain" });
        response.end(result.body);
      } else {
        response.writeHead(result.status);
        response.end(result.body);
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/webhook/meta") {
      const payload = await readBody(request);
      const result = await saasWebhookEvent(payload);
      sendJson(response, result.status, result.body);
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (await handleApi(request, response)) {
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Internal server error" });
  }
}).listen(env.port, () => {
  console.log(`Respuesta360 running on http://localhost:${env.port}`);
});
