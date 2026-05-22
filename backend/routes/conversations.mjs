// Conversation routes. JSON persistence is temporary until a real database is added.
// GET /api/conversations/:companyId

import { readFile } from "node:fs/promises";
import { ensureDataFile } from "../utils/dataPaths.mjs";

let conversationsPath = null;

async function getConversationsPath() {
  conversationsPath = conversationsPath || await ensureDataFile("conversations.mock.json");
  return conversationsPath;
}

async function readConversations() {
  return JSON.parse(await readFile(await getConversationsPath(), "utf8"));
}

export async function handleGetConversations(companyId) {
  const conversations = await readConversations();
  const companyConversations = conversations
    .filter((conversation) => conversation.companyId === companyId)
    .map(({ messages, ...conversation }) => ({
      ...conversation,
      messageCount: messages.length,
    }));

  return {
    status: 200,
    body: {
      companyId,
      conversations: companyConversations,
    },
  };
}
