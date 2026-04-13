import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface GenerateBody {
  concept?: string;
  filters?: {
    tlds?: string[];
    style?: string;
    syllables?: string;
  };
}

interface GeneratedName {
  name: string;
  rationale: string;
}

const SYSTEM_PROMPT = `You are an expert brand naming consultant.
You generate short, memorable, brandable names for new ventures.

RULES:
- Return 10 candidate names.
- Each name should be pronounceable, easy to spell, and distinctive.
- Avoid generic dictionary words unless they are used creatively.
- Avoid offensive or overly trendy names.
- Keep rationales short (<= 18 words), explaining the feel / concept link.

OUTPUT FORMAT:
Respond with ONLY a JSON object, no prose or markdown:
{ "names": [ { "name": "Example", "rationale": "Why it fits." }, ... ] }`;

function buildUserPrompt(body: GenerateBody): string {
  const concept = (body.concept || "").trim();
  const style = body.filters?.style || "any";
  const syllables = body.filters?.syllables || "any";
  const tlds = (body.filters?.tlds || []).join(", ") || ".com";

  const constraints: string[] = [];
  if (style === "one-word") constraints.push("single-word names only");
  else if (style === "two-word") constraints.push("two-word names (can be fused)");
  else if (style === "portmanteau")
    constraints.push("portmanteaus (blended/invented words)");

  if (syllables === "short") constraints.push("1-2 syllables");
  else if (syllables === "medium") constraints.push("2-3 syllables");

  constraints.push(
    `should read well as a ${tlds} domain (no numbers or hyphens in the name)`
  );

  return `Business concept:\n${concept}\n\nConstraints:\n- ${constraints.join(
    "\n- "
  )}\n\nReturn the JSON object now.`;
}

function extractJson(text: string): { names: GeneratedName[] } | null {
  // Try straight parse first
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.names)) return parsed;
  } catch {
    // fall through
  }
  // Try to find the first {...} blob.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (parsed && Array.isArray(parsed.names)) return parsed;
  } catch {
    return null;
  }
  return null;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the server.",
      },
      { status: 500 }
    );
  }

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const concept = (body.concept || "").trim();
  if (!concept) {
    return NextResponse.json(
      { error: "Missing 'concept' in request body" },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(body) }],
    });

    // Collect text blocks.
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

    const parsed = extractJson(text);
    if (!parsed) {
      return NextResponse.json(
        {
          error: "Model did not return valid JSON",
          raw: text,
        },
        { status: 502 }
      );
    }

    // Normalize + clamp length.
    const names: GeneratedName[] = parsed.names
      .filter(
        (n): n is GeneratedName =>
          !!n && typeof n.name === "string" && typeof n.rationale === "string"
      )
      .map((n) => ({
        name: n.name.trim(),
        rationale: n.rationale.trim(),
      }))
      .filter((n) => n.name.length > 0)
      .slice(0, 12);

    return NextResponse.json({ names });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Claude API call failed: ${message}` },
      { status: 502 }
    );
  }
}
