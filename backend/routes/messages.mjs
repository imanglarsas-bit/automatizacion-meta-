// Message routes. JSON persistence is temporary until a real database is added.
// GET  /api/messages/:companyId/:conversationId
// POST /api/messages/:companyId/:conversationId/reply

import { readFile, writeFile } from "node:fs/promises";
import { sendMessage } from "../services/meta/metaService.mjs";
import { ensureDataFile } from "../utils/dataPaths.mjs";

let conversationsPath = null;

async function getConversationsPath() {
  conversationsPath = conversationsPath || await ensureDataFile("conversations.mock.json");
  return conversationsPath;
}

async function readConversations() {
  return JSON.parse(await readFile(await getConversationsPath(), "utf8"));
}

async function saveConversations(conversations) {
  await writeFile(await getConversationsPath(), JSON.stringify(conversations, null, 2));
}

export async function handleGetMessages(companyId, conversationId) {
  const conversations = await readConversations();
  const conversation = conversations.find(
    (item) => item.companyId === companyId && item.conversationId === conversationId,
  );

  if (!conversation) {
    return {
      status: 404,
      body: { error: "Conversación no encontrada." },
    };
  }

  return {
    status: 200,
    body: conversation,
  };
}

export async function handleReplyToConversation(companyId, conversationId, body) {
  const reply = String(body.reply || "").trim();
  if (!reply) {
    return {
      status: 400,
      body: { error: "La respuesta no puede estar vacía." },
    };
  }

  const conversations = await readConversations();
  const conversation = conversations.find(
    (item) => item.companyId === companyId && item.conversationId === conversationId,
  );

  if (!conversation) {
    return {
      status: 404,
      body: { error: "Conversación no encontrada." },
    };
  }

  const message = {
    id: `human-${Date.now()}`,
    sender: "human",
    text: reply,
    createdAt: new Date().toISOString(),
  };

  conversation.messages.push(message);
  conversation.status = "answered";
  conversation.lastMessageAt = message.createdAt;

  const metaResult = await sendMessage({
    channel: conversation.channel,
    recipientId: conversation.customerId,
    text: reply,
  });

  await saveConversations(conversations);

  return {
    status: 200,
    body: {
      ok: true,
      conversation,
      metaResult,
    },
  };
}
