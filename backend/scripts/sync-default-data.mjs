import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("../..", import.meta.url)));
const seedDir = join(root, "backend", "data");
const targetDir = process.env.DATA_DIR || seedDir;

const files = {
  companies: "companies.mock.json",
  users: "client-users.mock.json",
  plans: "plans.mock.json",
  conversations: "conversations.mock.json",
  usage: "usage.mock.json",
  leadRules: "lead-rules.mock.json",
  companySettings: "company-settings.mock.json",
  training: "training.json",
};

async function readJson(path, fallback) {
  if (!existsSync(path)) {
    return fallback;
  }

  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function mergeArrayByKey(current, seed, key) {
  const seen = new Set(current.map((item) => item[key]));
  const missing = seed.filter((item) => !seen.has(item[key]));
  return [...current, ...missing];
}

function mergeObjectKeys(current, seed) {
  return {
    ...seed,
    ...current,
  };
}

async function syncFile(filename, merge) {
  const seedPath = join(seedDir, filename);
  const targetPath = join(targetDir, filename);
  const seed = await readJson(seedPath, merge.empty);
  const current = await readJson(targetPath, merge.empty);
  const next = merge.apply(current, seed);
  const changed = JSON.stringify(current) !== JSON.stringify(next);

  if (changed) {
    await writeJson(targetPath, next);
  }

  return { filename, changed };
}

const results = [];

results.push(await syncFile(files.plans, {
  empty: {},
  apply: (current, seed) => ({
    ...current,
    start: seed.start,
    pro: seed.pro,
    business: seed.business,
  }),
}));

results.push(await syncFile(files.companies, {
  empty: [],
  apply: (current, seed) => mergeArrayByKey(current, seed, "companyId"),
}));

results.push(await syncFile(files.users, {
  empty: [],
  apply: (current, seed) => mergeArrayByKey(current, seed, "username"),
}));

results.push(await syncFile(files.conversations, {
  empty: [],
  apply: (current, seed) => mergeArrayByKey(current, seed, "conversationId"),
}));

for (const filename of [files.usage, files.leadRules, files.companySettings]) {
  results.push(await syncFile(filename, {
    empty: {},
    apply: mergeObjectKeys,
  }));
}

results.push(await syncFile(files.training, {
  empty: [],
  apply: (current, seed) => mergeArrayByKey(current, seed, "id"),
}));

console.log(`Datos sincronizados en ${targetDir}`);
for (const result of results) {
  console.log(`${result.changed ? "actualizado" : "sin cambios"} ${result.filename}`);
}
