import { logger } from "../../utils/logger.mjs";

let anthropicClient = null;

async function getClient() {
  if (anthropicClient) return anthropicClient;
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return anthropicClient;
  } catch {
    logger.warn("@anthropic-ai/sdk no disponible. Usando mock.");
    return null;
  }
}

export async function callAnthropic({ model = "claude-3-5-sonnet-20241022", systemPrompt, userMessage }) {
  const client = await getClient();

  if (!client) {
    logger.info("Anthropic mock activo (sin API key o SDK)");
    return {
      text: `[MOCK Anthropic] Recibí tu mensaje: "${userMessage}". Pronto un asesor te atenderá.`,
      mock: true,
      provider: "anthropic",
      model,
    };
  }

  try {
    logger.info("Llamando Anthropic", { model });
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    return {
      text: response.content[0]?.text ?? "",
      mock: false,
      provider: "anthropic",
      model,
      inputTokens:  response.usage?.input_tokens  ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  } catch (error) {
    logger.error("Error en Anthropic", { error: error.message });
    throw error;
  }
}
