import { buildSystemPrompt } from "../services/ai/promptBuilder.mjs";
import { routeAI }           from "../services/ai/aiRouterService.mjs";

export async function handleHotel({ company, unit, message }) {
  const systemPrompt = await buildSystemPrompt({ company, unit });
  const result = await routeAI({ company, systemPrompt, userMessage: message });

  return {
    unit: unit?.name ?? "Mucuba Hotel & Glamping",
    unitType: "hotel",
    ...result,
  };
}
