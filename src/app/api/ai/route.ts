import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODEL = "claude-opus-5-5";

type Action = "summarize" | "rewrite" | "autotag" | "ask";

function enabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function GET() {
  return NextResponse.json({ enabled: enabled() });
}

function textOf(message: Anthropic.Beta.BetaMessage) {
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export async function POST(request: NextRequest) {
  if (!enabled()) {
    return NextResponse.json(
      { error: "AI is not configured. Add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables." },
      { status: 501 },
    );
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    action?: Action;
    text?: string;
    instruction?: string;
    question?: string;
    existingTags?: string[];
  } | null;
  if (!body?.action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  const text = (body.text ?? "").slice(0, 200_000);
  const client = new Anthropic();

  const call = (system: string, user: string, extra: Partial<Anthropic.Beta.MessageCreateParamsNonStreaming> = {}) =>
    client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: user }],
      ...extra,
    });

  try {
    switch (body.action) {
      case "summarize": {
        if (!text.trim()) return NextResponse.json({ error: "This note is empty." }, { status: 400 });
        const msg = await call(
          "You summarize personal notes. Reply with a concise summary (2-5 sentences, or a short bullet list if the note is a list). Plain text, no preamble.",
          `<note>\n${text}\n</note>`,
        );
        if (msg.stop_reason === "refusal") throw new Error("The AI declined this request.");
        return NextResponse.json({ result: textOf(msg) });
      }
      case "rewrite": {
        if (!text.trim()) return NextResponse.json({ error: "Nothing to rewrite." }, { status: 400 });
        const instruction = body.instruction?.trim() || "Improve clarity, flow and grammar while keeping the meaning and tone.";
        const msg = await call(
          "You rewrite text for a note-taking app. Follow the instruction. Return only the rewritten text in Markdown (headings, lists and bold allowed), with no preamble or commentary.",
          `<instruction>${instruction}</instruction>\n<text>\n${text}\n</text>`,
        );
        if (msg.stop_reason === "refusal") throw new Error("The AI declined this request.");
        return NextResponse.json({ result: textOf(msg) });
      }
      case "autotag": {
        if (!text.trim()) return NextResponse.json({ error: "This note is empty." }, { status: 400 });
        const msg = await call(
          "Suggest 1-5 short, lowercase topic tags (single words or kebab-case) for the note. Prefer reusing the user's existing tags when they fit.",
          `<existing_tags>${(body.existingTags ?? []).join(", ")}</existing_tags>\n<note>\n${text.slice(0, 20_000)}\n</note>`,
          {
            output_config: {
              effort: "low",
              format: {
                type: "json_schema",
                schema: {
                  type: "object",
                  properties: { tags: { type: "array", items: { type: "string" } } },
                  required: ["tags"],
                  additionalProperties: false,
                },
              },
            },
          },
        );
        if (msg.stop_reason === "refusal") throw new Error("The AI declined this request.");
        const parsed = JSON.parse(textOf(msg) || "{}") as { tags?: string[] };
        const tags = (parsed.tags ?? [])
          .map((t) => t.toLowerCase().replace(/^#/, "").trim().slice(0, 40))
          .filter(Boolean)
          .slice(0, 5);
        return NextResponse.json({ tags });
      }
      case "ask": {
        const question = body.question?.trim();
        if (!question) return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
        // RLS limits this to notes the user owns or collaborates on.
        const { data: notes } = await supabase
          .from("notes")
          .select("id,title,content_text,updated_at")
          .eq("is_archived", false)
          .order("updated_at", { ascending: false })
          .limit(60);
        const corpus = (notes ?? [])
          .map(
            (n) =>
              `<note id="${n.id}" title="${(n.title || "Untitled").replace(/"/g, "'")}" updated="${n.updated_at}">\n${(n.content_text ?? "").slice(0, 6000)}\n</note>`,
          )
          .join("\n");
        const msg = await call(
          "You answer questions using only the user's notes provided. Be concise. When you use a note, cite it inline by its title in quotes. If the notes don't contain the answer, say so plainly.",
          `<notes>\n${corpus || "(no notes)"}\n</notes>\n\nQuestion: ${question}`,
          { output_config: { effort: "medium" } },
        );
        if (msg.stop_reason === "refusal") throw new Error("The AI declined this request.");
        return NextResponse.json({ result: textOf(msg) });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "AI is busy — try again in a moment." }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "The ANTHROPIC_API_KEY is invalid." }, { status: 500 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI error: ${err.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI request failed" }, { status: 500 });
  }
}
