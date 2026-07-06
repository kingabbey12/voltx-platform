export interface ModelPricing {
  inputPricePerMillionTokens: number;
  outputPricePerMillionTokens: number;
}

/**
 * Estimated USD list pricing per 1M tokens, keyed by model id. These are
 * planning-grade estimates for internal cost visibility, not billing-grade
 * figures — confirm against each provider's current pricing page before
 * using this data for customer billing or margin decisions.
 */
const MODEL_PRICING: Readonly<Record<string, ModelPricing>> = {
  'gpt-5': { inputPricePerMillionTokens: 5, outputPricePerMillionTokens: 15 },
  'gpt-5-mini': { inputPricePerMillionTokens: 0.25, outputPricePerMillionTokens: 2 },
  'claude-opus-4-1': { inputPricePerMillionTokens: 15, outputPricePerMillionTokens: 75 },
  'claude-sonnet-4-5': { inputPricePerMillionTokens: 3, outputPricePerMillionTokens: 15 },
  'claude-haiku-4': { inputPricePerMillionTokens: 0.8, outputPricePerMillionTokens: 4 },
  'gemini-2.5-pro': { inputPricePerMillionTokens: 1.25, outputPricePerMillionTokens: 10 },
  'gemini-2.5-flash': { inputPricePerMillionTokens: 0.3, outputPricePerMillionTokens: 2.5 },
};

/**
 * Returns an estimated USD cost for the given token counts. Returns 0 for
 * unrecognized models rather than throwing — cost estimation must never be
 * allowed to fail a real AI request.
 */
export function calculateEstimatedCostUsd(
  modelId: string | undefined,
  inputTokens: number,
  outputTokens: number,
): number {
  if (!modelId) {
    return 0;
  }

  const pricing = MODEL_PRICING[modelId];
  if (!pricing) {
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillionTokens;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillionTokens;

  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
