import { readFile, writeFile } from "node:fs/promises";
import { ensureDataFile } from "../utils/dataPaths.mjs";

const channelScopes = {
  whatsapp: ["business_management", "whatsapp_business_management", "whatsapp_business_messaging"],
  instagram: ["instagram_basic", "instagram_manage_messages", "pages_show_list", "pages_read_engagement", "pages_manage_metadata"],
  facebook: ["pages_show_list", "pages_messaging", "pages_read_engagement", "pages_manage_metadata"],
  messenger: ["pages_show_list", "pages_messaging", "pages_manage_metadata"],
};

let settingsPath = null;

async function getSettingsPath() {
  settingsPath = settingsPath || await ensureDataFile("company-settings.mock.json");
  return settingsPath;
}

async function readSettingsStore() {
  try {
    return JSON.parse(await readFile(await getSettingsPath(), "utf8"));
  } catch {
    return {};
  }
}

async function writeSettingsStore(store) {
  await writeFile(await getSettingsPath(), JSON.stringify(store, null, 2));
}

export function handleGetMetaConnectUrl(url) {
  const appId = process.env.META_APP_ID || "";
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || "";
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI || (publicBaseUrl ? `${publicBaseUrl}/meta/oauth/callback` : "");
  const loginConfigId = process.env.META_LOGIN_CONFIG_ID || "";
  const graphVersion = process.env.GRAPH_API_VERSION || "v22.0";
  const companyId = String(url.searchParams.get("companyId") || "").trim();
  const channel = String(url.searchParams.get("channel") || "").trim().toLowerCase();
  const scopes = channelScopes[channel];

  if (!companyId || !scopes) {
    return { status: 400, body: { error: "Empresa o canal no válido." } };
  }

  if (!appId || !redirectUri) {
    return {
      status: 428,
      body: {
        error: "Faltan credenciales de Meta para iniciar la conexión real.",
        setup: [
          "META_APP_ID",
          "PUBLIC_BASE_URL o META_OAUTH_REDIRECT_URI",
          "META_LOGIN_CONFIG_ID para WhatsApp Embedded Signup, si aplica",
        ],
      },
    };
  }

  const state = Buffer.from(JSON.stringify({ companyId, channel, nonce: Date.now() })).toString("base64url");
  const connectUrl = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  connectUrl.searchParams.set("client_id", appId);
  connectUrl.searchParams.set("redirect_uri", redirectUri);
  connectUrl.searchParams.set("state", state);
  connectUrl.searchParams.set("response_type", "code");
  connectUrl.searchParams.set("scope", scopes.join(","));

  if (loginConfigId) {
    connectUrl.searchParams.set("config_id", loginConfigId);
    connectUrl.searchParams.set("override_default_response_type", "true");
  }

  return {
    status: 200,
    body: {
      connectUrl: connectUrl.toString(),
      channel,
      companyId,
    },
  };
}

export async function handleMetaOAuthCallback(url) {
  const state = decodeState(url.searchParams.get("state"));
  const code = String(url.searchParams.get("code") || "");
  const error = String(url.searchParams.get("error_description") || url.searchParams.get("error") || "");

  if (!state?.companyId || !state?.channel) {
    return callbackPage("No pudimos identificar la empresa de esta conexión.", false);
  }

  const store = await readSettingsStore();
  const current = store[state.companyId] || {};
  const metaConnections = current.metaConnections || {};
  const now = new Date().toISOString();

  metaConnections[state.channel] = {
    status: code ? "connected" : "error",
    code,
    error,
    connectedAt: code ? now : "",
    updatedAt: now,
  };

  store[state.companyId] = {
    ...current,
    metaConnections,
    channels: {
      ...(current.channels || {}),
      [state.channel]: Boolean(code),
    },
    updatedAt: now,
  };

  await writeSettingsStore(store);

  if (!code) {
    return callbackPage(error || "Meta no completó la autorización.", false);
  }

  return callbackPage("Conexión recibida. Ya puedes volver al panel administrador.", true);
}

function decodeState(value) {
  try {
    return JSON.parse(Buffer.from(String(value || ""), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function callbackPage(message, ok) {
  const title = ok ? "Conexión completada" : "Conexión no completada";
  const color = ok ? "#7DBA2E" : "#f97316";
  return {
    status: ok ? 200 : 400,
    body: `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, Arial, sans-serif; background: #071B2D; color: #fff; }
      main { width: min(520px, calc(100% - 32px)); padding: 32px; border: 1px solid rgba(255,255,255,.14); border-radius: 16px; background: rgba(255,255,255,.06); box-shadow: 0 24px 80px rgba(0,0,0,.32); }
      strong { display: inline-flex; width: 14px; height: 14px; border-radius: 99px; background: ${color}; box-shadow: 0 0 24px ${color}; margin-right: 8px; }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { margin: 0 0 20px; color: rgba(255,255,255,.78); line-height: 1.6; }
      button { border: 0; border-radius: 10px; padding: 12px 18px; background: #00AEEF; color: #071B2D; font-weight: 800; cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1><strong></strong>${title}</h1>
      <p>${escapeHTML(message)}</p>
      <button onclick="window.close()">Cerrar ventana</button>
    </main>
  </body>
</html>`,
  };
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
