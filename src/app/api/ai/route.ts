import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { activeModel, activeProvider, AiError, complete, parseJsonObject } from "@/lib/ai";

type Action = "summarize" | "rewrite" | "autotag" | "ask";

export async function GET() {
  return NextResponse.json({ enabled: activeProvider() !== null, provider: activeProvider(), model: activeModel() });
}

export async function POST(request: NextRequest) {
  if (!activeProvider()) {
    return NextResponse.json(
      { error: "AI is not configured. Add OPENROUTER_API_KEY in Vercel → Settings → Environment Variables." },
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

  try {
    switch (body.action) {
      case "summarize": {
        if (!text.trim()) return NextResponse.json({ error: "This note is empty." }, { status: 400 });
        const result = await complete({
          system:
            "You summarize personal notes. Reply with a concise summary (2-5 sentences, or a short bullet list if the note is a list). Plain text, no preamble.",
          user: `<note>\n${text}\n</note>`,
        });
        return NextResponse.json({ result });
      }
      case "rewrite": {
        if (!text.trim()) return NextResponse.json({ error: "Nothing to rewrite." }, { status: 400 });
        const instruction = body.instruction?.trim() || "Improve clarity, flow and grammar while keeping the meaning and tone.";
        const result = await complete({
          system:
            "You rewrite text for a note-taking app. Follow the instruction. Return only the rewritten text in Markdown (headings, lists and bold allowed), with no preamble or commentary.",
          user: `<instruction>${instruction}</instruction>\n<text>\n${text}\n</text>`,
        });
        return NextResponse.json({ result });
      }
      case "autotag": {
        if (!text.trim()) return NextResponse.json({ error: "This note is empty." }, { status: 400 });
        const raw = await complete({
          system:
            'Suggest 1-5 short, lowercase topic tags (single words or kebab-case) for the note. Prefer reusing the user\'s existing tags when they fit. Reply with only JSON in the form {"tags": ["tag-one", "tag-two"]}.',
          user: `<existing_tags>${(body.existingTags ?? []).join(", ")}</existing_tags>\n<note>\n${text.slice(0, 20_000)}\n</note>`,
          maxTokens: 300,
        });
        const parsed = parseJsonObject<{ tags?: unknown }>(raw);
        const list = Array.isArray(parsed?.tags) ? parsed.tags : [];
        const tags = list
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.toLowerCase().replace(/^#/, "").trim().slice(0, 40))
          .filter(Boolean)
          .slice(0, 5);
        if (!tags.length) return NextResponse.json({ error: "The AI didn't suggest any tags. Try again." }, { status: 502 });
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
        const result = await complete({
          system:
            "You answer questions using only the user's notes provided. Be concise. When you use a note, cite it inline by its title in quotes. If the notes don't contain the answer, say so plainly.",
          user: `<notes>\n${corpus || "(no notes)"}\n</notes>\n\nQuestion: ${question}`,
          effort: "medium",
        });
        return NextResponse.json({ result });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof AiError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI request failed" }, { status: 500 });
  }
}
