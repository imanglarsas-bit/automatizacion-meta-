import { logger } from "../../utils/logger.mjs";

// Mock Meta service. Real API calls are disabled until Meta Business credentials are configured.
// To enable real sending, set META_ACCESS_TOKEN and META_PHONE_NUMBER_ID in environment.

const GRAPH_VERSION = process.env.GRAPH_API_VERSION ?? "v22.0";

export async function sendMessage({ channel, recipientId, text, phoneNumberId, templateName, languageCode }) {
  if (process.env.META_LIVE_MODE !== "true") {
    logger.info("[Meta MOCK] Mensaje simulado", { channel, recipientId, text: text.slice(0, 80) });
    return { mock: true, channel, recipientId };
  }

  if (channel === "whatsapp") {
    return sendWhatsApp({ to: recipientId, text, phoneNumberId, templateName, languageCode });
  }

  return sendMessenger({ recipientId, text });
}

async function sendWhatsApp({ to, text, phoneNumberId, templateName, languageCode }) {
  const id = phoneNumberId ?? process.env.META_PHONE_NUMBER_ID ?? process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_ACCESS_TOKEN ?? process.env.WHATSAPP_ACCESS_TOKEN;
  if (!id || !token) {
    logger.warn("WhatsApp: faltan META_PHONE_NUMBER_ID/META_ACCESS_TOKEN");
    return { skipped: true };
  }

  const body = templateName
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode || "en_US" },
        },
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      };

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  return response.json();
}

async function sendMessenger({ recipientId, text }) {
  const token = process.env.META_ACCESS_TOKEN ?? process.env.PAGE_ACCESS_TOKEN;
  if (!token) {
    logger.warn("Messenger: falta META_ACCESS_TOKEN o PAGE_ACCESS_TOKEN");
    return { skipped: true };
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    }
  );
  return response.json();
}
