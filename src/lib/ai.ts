import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * AI provider layer.
 * - OPENROUTER_API_KEY set  → OpenRouter (any model; choose with OPENROUTER_MODEL)
 * - else ANTHROPIC_API_KEY  → Claude via the Anthropic SDK
 * - neither                 → AI features stay disabled
 */

export type Provider = "openrouter" | "anthropic";

export class AiError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

const ANTHROPIC_MODEL = "claude-opus-5-5";
const DEFAULT_OPENROUTER_MODEL = "openrouter/auto";

export function activeProvider(): Provider | null {
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function activeModel(): string | null {
  const p = activeProvider();
  if (p === "openrouter") return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
  if (p === "anthropic") return ANTHROPIC_MODEL;
  return null;
}

type Request = { system: string; user: string; effort?: "low" | "medium" | "high"; maxTokens?: number };

export async function complete(req: Request): Promise<string> {
  const provider = activeProvider();
  if (!provider) throw new AiError("AI is not configured. Add OPENROUTER_API_KEY in Vercel → Settings → Environment Variables.", 501);
  return provider === "openrouter" ? completeOpenRouter(req) : completeAnthropic(req);
}

// ---------------------------------------------------------------------------
// OpenRouter (OpenAI-compatible chat completions API)
// ---------------------------------------------------------------------------
type OpenRouterResponse = {
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  error?: { message?: string; code?: number | string };
};

async function completeOpenRouter({ system, user, maxTokens = 4000 }: Request): Promise<string> {
  const base = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // Optional attribution headers shown in the OpenRouter dashboard.
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://cognithan.vercel.app",
      "X-Title": "Cognithan",
    },
    body: JSON.stringify({
      model: activeModel(),
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  }).catch((err: unknown) => {
    throw new AiError(err instanceof Error && err.name === "TimeoutError" ? "The AI took too long to respond." : "Couldn't reach OpenRouter.", 502);
  });

  const data = (await res.json().catch(() => ({}))) as OpenRouterResponse;
  if (!res.ok || data.error) {
    const msg = data.error?.message ?? res.statusText;
    if (res.status === 401) throw new AiError("The OPENROUTER_API_KEY is invalid.", 500);
    if (res.status === 402) throw new AiError("Your OpenRouter account is out of credits.", 402);
    if (res.status === 429) throw new AiError("AI is busy — try again in a moment.", 429);
    if (res.status === 400 && /model/i.test(msg)) throw new AiError(`OpenRouter model error: ${msg}. Check OPENROUTER_MODEL.`, 500);
    throw new AiError(`AI error: ${msg}`, 502);
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new AiError("The AI returned an empty response.", 502);
  return text;
}

// ---------------------------------------------------------------------------
// Anthropic (Claude)
// ---------------------------------------------------------------------------
async function completeAnthropic({ system, user, effort = "low", maxTokens = 16000 }: Request): Promise<string> {
  const client = new Anthropic();
  try {
    const msg = await client.beta.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort },
      system,
      messages: [{ role: "user", content: user }],
    });
    if (msg.stop_reason === "refusal") throw new AiError("The AI declined this request.", 422);
    return msg.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.RateLimitError) throw new AiError("AI is busy — try again in a moment.", 429);
    if (err instanceof Anthropic.AuthenticationError) throw new AiError("The ANTHROPIC_API_KEY is invalid.", 500);
    if (err instanceof Anthropic.APIError) throw new AiError(`AI error: ${err.message}`, 502);
    throw err;
  }
}

/** Pull the first JSON object out of a model reply (handles ```json fences and extra prose). */
export function parseJsonObject<T>(text: string): T | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
