// Placeholder routes for future conversation history persistence.
// GET /api/conversations/:companyId  — lista de conversaciones (pendiente DB real)

export async function handleGetConversations(companyId) {
  return {
    status: 200,
    body: {
      companyId,
      conversations: [],
      note: "Persistencia de conversaciones pendiente de base de datos real.",
    },
  };
}
