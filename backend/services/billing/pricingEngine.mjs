// Token-based cost estimation per provider/model (USD per million tokens).
const RATES = {
  "claude-3-5-sonnet-20241022": { input: 3.0,  output: 15.0 },
  "claude-haiku-4-5-20251001":  { input: 0.80, output: 4.0  },
  "claude-3-opus-20240229":     { input: 15.0, output: 75.0 },
  "gpt-4o-mini":                { input: 0.15, output: 0.60 },
  "gpt-4.1":                    { input: 2.0,  output: 8.0  },
};

export function estimateCost({ model, inputTokens = 0, outputTokens = 0 }) {
  const rate = RATES[model] ?? { input: 1.0, output: 5.0 };
  return +((inputTokens * rate.input + outputTokens * rate.output) / 1_000_000).toFixed(8);
}

export function estimateCostFromMessage(model, message) {
  // Rough estimate: 1 token ≈ 4 chars
  const inputTokens  = Math.ceil(message.length / 4);
  const outputTokens = 250; // average response
  return estimateCost({ model, inputTokens, outputTokens });
}
