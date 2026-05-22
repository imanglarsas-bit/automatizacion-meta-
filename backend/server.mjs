import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

// ── SaaS layer (non-destructive additions) ───────────────────────────────────
import { handleTestMessage }      from "./routes/testRoutes.mjs";
import { handleGetCompanies, handleGetCompany } from "./routes/companies.mjs";
import { handleGetMetrics }       from "./routes/metrics.mjs";
import { handleGetConversations } from "./routes/conversations.mjs";
import { handleGetMessages }      from "./routes/messages.mjs";
import { handleWebhookVerification as saasWebhookVerify,
         handleWebhookEvent as saasWebhookEvent } from "./routes/metaWebhook.mjs";
// ─────────────────────────────────────────────────────────────────────────────

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const dataDir = join(root, "backend", "data");
const trainingPath = join(dataDir, "training.json");

const env = {
  port: Number(process.env.PORT || 3000),
  verifyToken: process.env.META_VERIFY_TOKEN || "dev_verify_token",
  graphVersion: process.env.GRAPH_API_VERSION || "v22.0",
  whatsappToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  pageAccessToken: process.env.PAGE_ACCESS_TOKEN || "",
  platformPassword: process.env.PLATFORM_PASSWORD || "dev_admin",
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const privatePaths = new Set(["/plataforma.html", "/platform.css", "/platform.js"]);

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter((pair) => pair.length === 2),
  );
}

function isAuthenticated(request) {
  return parseCookies(request).r360_session === "active";
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

function sendLoginCookie(request, response) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  response.writeHead(302, {
    Location: "/plataforma.html",
    "Set-Cookie": `r360_session=active; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure}`,
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
  const password = form.get("password");

  if (password === env.platformPassword) {
    sendLoginCookie(request, response);
    return;
  }

  redirect(response, "/login.html?error=1");
}

async function readTraining() {
  if (!existsSync(trainingPath)) {
    return [];
  }

  return JSON.parse(await readFile(trainingPath, "utf8"));
}

async function saveTraining(items) {
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
    await respondToIncomingMessage(incoming);
  }

  sendJson(response, 200, { ok: true, received: Boolean(incoming) });
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (!url.pathname.startsWith("/api/")) {
    return false;
  }

  if (!isAuthenticated(request)) {
    sendJson(response, 401, { error: "Authentication required" });
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
    const result = await handleTestMessage(body);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/companies") {
    const result = await handleGetCompanies();
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/companies/")) {
    const companyId = url.pathname.replace("/api/companies/", "");
    const result = await handleGetCompany(companyId);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/metrics/company/")) {
    const companyId = url.pathname.replace("/api/metrics/company/", "");
    const result = await handleGetMetrics(companyId);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/conversations/")) {
    const companyId = url.pathname.replace("/api/conversations/", "");
    const result = await handleGetConversations(companyId);
    sendJson(response, result.status, result.body);
    return true;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/messages/")) {
    const parts = url.pathname.replace("/api/messages/", "").split("/");
    const result = await handleGetMessages(parts[0], parts[1]);
    sendJson(response, result.status, result.body);
    return true;
  }

  // ────────────────────────────────────────────────────────────────────────────

  return false;
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;

  if (privatePaths.has(requestedPath) && !isAuthenticated(request)) {
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

    if (request.method === "POST" && url.pathname === "/logout") {
      sendLogoutCookie(request, response);
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
