export const PLANS = {
  starter: {
    name: "Starter",
    monthlyConversationLimit: 100,
    priceUSD: 29,
    features: ["1 canal", "Bot básico", "Soporte por correo"],
  },
  business: {
    name: "Business",
    monthlyConversationLimit: 500,
    priceUSD: 79,
    features: ["4 canales Meta", "Bot con IA", "Métricas básicas", "Soporte prioritario"],
  },
  premium: {
    name: "Premium",
    monthlyConversationLimit: 2000,
    priceUSD: 199,
    features: ["4 canales Meta", "Bot IA multimodelo", "Métricas avanzadas", "Panel admin", "SLA garantizado"],
  },
};

export function getPlan(planKey) {
  return PLANS[planKey] ?? PLANS.starter;
}
