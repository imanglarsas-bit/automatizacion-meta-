import { logger } from "../../utils/logger.mjs";

let openaiClient = null;

async function getClient() {
  if (openaiClient) return openaiClient;
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const { default: OpenAI } = await import("openai");
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openaiClient;
  } catch {
    logger.warn("openai SDK no disponible. Usando mock.");
    return null;
  }
}

export async function callOpenAI({ model = "gpt-4o-mini", systemPrompt, userMessage }) {
  const client = await getClient();

  if (!client) {
    logger.info("OpenAI mock activo (sin API key o SDK)");
    return {
      text: `[MOCK OpenAI] Recibí tu mensaje: "${userMessage}". Pronto un asesor te atenderá.`,
      mock: true,
      provider: "openai",
      model,
    };
  }

  try {
    logger.info("Llamando OpenAI", { model });
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage },
      ],
      max_tokens: 1024,
    });

    const choice = response.choices[0];
    return {
      text: choice?.message?.content ?? "",
      mock: false,
      provider: "openai",
      model,
      inputTokens:  response.usage?.prompt_tokens     ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  } catch (error) {
    logger.error("Error en OpenAI", { error: error.message });
    throw error;
  }
}
