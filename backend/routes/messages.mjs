// Placeholder routes for future message history persistence.
// GET /api/messages/:companyId/:conversationId  — mensajes de una conversación

export async function handleGetMessages(companyId, conversationId) {
  return {
    status: 200,
    body: {
      companyId,
      conversationId,
      messages: [],
      note: "Historial de mensajes pendiente de base de datos real.",
    },
  };
}
