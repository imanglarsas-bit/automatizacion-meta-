import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../../utils/logger.mjs";

const dir = dirname(fileURLToPath(import.meta.url));

const promptCache = new Map();

async function loadPromptFile(filename) {
  if (promptCache.has(filename)) return promptCache.get(filename);
  try {
    const filePath = join(dir, "../../prompts", filename);
    const content = await readFile(filePath, "utf8");
    promptCache.set(filename, content.trim());
    return promptCache.get(filename);
  } catch {
    logger.warn("Prompt file not found, using default", { filename });
    return "Eres un asistente virtual profesional. Responde de forma clara y concisa en español.";
  }
}

export async function buildSystemPrompt({ company, unit }) {
  const base = await loadPromptFile(company.promptFile || "default.txt");

  if (!unit) return base;

  const unitContext = [
    `\n---`,
    `El cliente está consultando sobre: **${unit.name}** (${unit.type}).`,
    `Enfoca tu respuesta en los servicios de esta unidad.`,
  ].join("\n");

  return base + unitContext;
}
