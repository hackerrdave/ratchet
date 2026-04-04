import { encoding_for_model, type TiktokenModel } from "tiktoken";

// Cache encodings to avoid re-init overhead
let cachedEncoding: ReturnType<typeof encoding_for_model> | null = null;
let cachedModelName: string | null = null;

/**
 * Map a Claude model string to a tiktoken-compatible model for token counting.
 * Claude uses a similar BPE tokenizer to GPT-4; cl100k_base is a reasonable proxy.
 */
function getTiktokenModel(_model: string): TiktokenModel {
  // Claude tokenizers aren't in tiktoken — cl100k_base (GPT-4) is the closest proxy.
  // Token counts will be approximate but directionally correct for efficiency comparisons.
  return "gpt-4";
}

function getEncoding(model: string) {
  const tiktokenModel = getTiktokenModel(model);
  const key = tiktokenModel;
  if (cachedEncoding && cachedModelName === key) return cachedEncoding;
  if (cachedEncoding) cachedEncoding.free();
  cachedEncoding = encoding_for_model(tiktokenModel);
  cachedModelName = key;
  return cachedEncoding;
}

/**
 * Count tokens in a string using tiktoken.
 * Returns an approximate count (Claude tokenizers differ slightly from OpenAI's).
 */
export function countTokens(text: string, model: string = "gpt-4"): number {
  const enc = getEncoding(model);
  const tokens = enc.encode(text);
  return tokens.length;
}

/**
 * Estimate the cost of a prompt based on token count.
 * This is the cost *per API call* that includes this content as input.
 */
export function estimatePromptCostPerCall(
  tokenCount: number,
  model: string
): number {
  const pricing: Record<string, number> = {
    opus: 15 / 1_000_000,
    sonnet: 3 / 1_000_000,
    haiku: 0.8 / 1_000_000,
  };
  const family = Object.keys(pricing).find((k) => model.includes(k));
  const rate = family ? pricing[family]! : pricing["haiku"]!;
  return tokenCount * rate;
}

export interface DecodedToken {
  /** The token ID from the vocabulary */
  id: number;
  /** The decoded text this token represents */
  text: string;
}

/**
 * Tokenize text and return each individual token with its decoded text.
 */
export function tokenize(text: string, model: string = "gpt-4"): DecodedToken[] {
  const enc = getEncoding(model);
  const ids = enc.encode(text);
  const result: DecodedToken[] = [];
  for (const id of ids) {
    const bytes = enc.decode(new Uint32Array([id]));
    const decoded = new TextDecoder().decode(bytes);
    result.push({ id, text: decoded });
  }
  return result;
}

export interface TokenStats {
  tokenCount: number;
  estimatedCostPerCall: number;
}

export function getTokenStats(text: string, model: string = "gpt-4"): TokenStats {
  const tokenCount = countTokens(text, model);
  return {
    tokenCount,
    estimatedCostPerCall: estimatePromptCostPerCall(tokenCount, model),
  };
}
