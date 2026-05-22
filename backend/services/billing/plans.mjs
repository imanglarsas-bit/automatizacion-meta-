export const PLAN_KEYS = ["start", "pro", "business"];

export const FEATURES = {
  AI_API: "aiApi",
  LIMITED_AI_API: "limitedAiApi",
  ADVANCED_AUTOMATIONS: "advancedAutomations",
  ADVANCED_INTEGRATIONS: "advancedIntegrations",
  BUSINESS_DASHBOARD: "businessDashboard",
  MULTI_USER: "multiUser",
  FORM_AUTOMATIONS: "formAutomations",
  CUSTOM_INTEGRATIONS: "customIntegrations",
  META_INTEGRATION: "metaIntegration",
  LEAD_CAPTURE: "leadCapture",
};

export const PLANS = {
  start: {
    key: "start",
    name: "Start",
    monthlyMessageLimit: 1000,
    monthlyConversationLimit: 1000,
    monthlyAiRequestLimit: 0,
    userLimit: 1,
    channels: ["whatsapp", "instagram", "facebook"],
    automationMode: "rules",
    description: "Automatizaciones, respuestas rápidas, formularios y captura básica de leads sin APIs de IA.",
    features: {
      [FEATURES.AI_API]: false,
      [FEATURES.LIMITED_AI_API]: false,
      [FEATURES.ADVANCED_AUTOMATIONS]: false,
      [FEATURES.ADVANCED_INTEGRATIONS]: false,
      [FEATURES.BUSINESS_DASHBOARD]: false,
      [FEATURES.MULTI_USER]: false,
      [FEATURES.FORM_AUTOMATIONS]: true,
      [FEATURES.CUSTOM_INTEGRATIONS]: false,
      [FEATURES.META_INTEGRATION]: true,
      [FEATURES.LEAD_CAPTURE]: true,
    },
  },
  pro: {
    key: "pro",
    name: "Pro",
    monthlyMessageLimit: 5000,
    monthlyConversationLimit: 5000,
    monthlyAiRequestLimit: 150,
    userLimit: 3,
    channels: ["whatsapp", "instagram", "facebook", "messenger"],
    automationMode: "hybrid-limited-ai",
    description: "Automatizaciones avanzadas con acceso limitado y controlado a funciones puntuales por API.",
    features: {
      [FEATURES.AI_API]: true,
      [FEATURES.LIMITED_AI_API]: true,
      [FEATURES.ADVANCED_AUTOMATIONS]: true,
      [FEATURES.ADVANCED_INTEGRATIONS]: false,
      [FEATURES.BUSINESS_DASHBOARD]: false,
      [FEATURES.MULTI_USER]: true,
      [FEATURES.FORM_AUTOMATIONS]: true,
      [FEATURES.CUSTOM_INTEGRATIONS]: false,
      [FEATURES.META_INTEGRATION]: true,
      [FEATURES.LEAD_CAPTURE]: true,
    },
  },
  business: {
    key: "business",
    name: "Business",
    monthlyMessageLimit: 15000,
    monthlyConversationLimit: 15000,
    monthlyAiRequestLimit: null,
    userLimit: null,
    channels: ["whatsapp", "instagram", "facebook", "messenger"],
    automationMode: "full-ai",
    description: "Acceso completo a APIs, IA, integraciones empresariales y funcionalidades premium.",
    features: {
      [FEATURES.AI_API]: true,
      [FEATURES.LIMITED_AI_API]: false,
      [FEATURES.ADVANCED_AUTOMATIONS]: true,
      [FEATURES.ADVANCED_INTEGRATIONS]: true,
      [FEATURES.BUSINESS_DASHBOARD]: true,
      [FEATURES.MULTI_USER]: true,
      [FEATURES.FORM_AUTOMATIONS]: true,
      [FEATURES.CUSTOM_INTEGRATIONS]: true,
      [FEATURES.META_INTEGRATION]: true,
      [FEATURES.LEAD_CAPTURE]: true,
    },
  },
};

const LEGACY_PLAN_MAP = {
  starter: "start",
  premium: "business",
};

export function normalizePlanKey(planKey) {
  const normalized = String(planKey || "").trim().toLowerCase();
  return LEGACY_PLAN_MAP[normalized] || normalized;
}

export function isValidPlan(planKey) {
  return PLAN_KEYS.includes(normalizePlanKey(planKey));
}

export function getPlan(planKey) {
  return PLANS[normalizePlanKey(planKey)] ?? PLANS.start;
}

export function listPlans() {
  return PLAN_KEYS.map((key) => PLANS[key]);
}

export function hasFeature(company, feature) {
  return Boolean(getPlan(company?.plan).features[feature]);
}
