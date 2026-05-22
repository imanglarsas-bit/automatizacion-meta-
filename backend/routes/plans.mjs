import { readFile, writeFile } from "node:fs/promises";
import { ensureDataFile } from "../utils/dataPaths.mjs";
import { PLAN_KEYS } from "../services/billing/plans.mjs";

let plansPath = null;

async function getPlansPath() {
  plansPath = plansPath || await ensureDataFile("plans.mock.json");
  return plansPath;
}

async function readPlansStore() {
  return JSON.parse(await readFile(await getPlansPath(), "utf8"));
}

async function writePlansStore(store) {
  await writeFile(await getPlansPath(), JSON.stringify(store, null, 2));
}

export async function handleGetPlans() {
  const store = await readPlansStore();
  return { status: 200, body: PLAN_KEYS.map((key) => store[key]).filter(Boolean) };
}

export async function handleUpdatePlan(key, body) {
  if (!PLAN_KEYS.includes(key)) {
    return { status: 404, body: { error: "Plan no encontrado." } };
  }

  const store = await readPlansStore();
  const current = store[key];

  const msgLimit = body.monthlyMessageLimit === "" || body.monthlyMessageLimit == null
    ? null
    : Number(body.monthlyMessageLimit);
  const convLimit = body.monthlyConversationLimit === "" || body.monthlyConversationLimit == null
    ? null
    : Number(body.monthlyConversationLimit);
  const aiLimit = body.monthlyAiRequestLimit === "" || body.monthlyAiRequestLimit == null
    ? null
    : Number(body.monthlyAiRequestLimit);
  const userLimit = body.userLimit === "" || body.userLimit == null
    ? null
    : Number(body.userLimit);

  store[key] = {
    ...current,
    name: String(body.name || current.name).trim(),
    description: String(body.description || current.description).trim(),
    monthlyMessageLimit: msgLimit,
    monthlyConversationLimit: convLimit,
    monthlyAiRequestLimit: aiLimit,
    userLimit,
    features: {
      ...current.features,
      aiApi: Boolean(body.features?.aiApi),
      limitedAiApi: Boolean(body.features?.limitedAiApi),
      advancedAutomations: Boolean(body.features?.advancedAutomations),
      advancedIntegrations: Boolean(body.features?.advancedIntegrations),
      businessDashboard: Boolean(body.features?.businessDashboard),
      multiUser: Boolean(body.features?.multiUser),
    },
  };

  await writePlansStore(store);
  return { status: 200, body: store[key] };
}
