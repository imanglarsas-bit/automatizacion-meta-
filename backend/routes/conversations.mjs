// Conversation routes. JSON persistence is temporary until a real database is added.
// GET /api/conversations/:companyId

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dataPath = join(fileURLToPath(new URL("..", import.meta.url)), "data", "conversations.mock.json");

async function readConversations() {
  return JSON.parse(await readFile(dataPath, "utf8"));
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
