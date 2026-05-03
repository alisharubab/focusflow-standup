// FocusFlow — generate-standup edge function
// Uses Lovable AI Gateway (no API key required from user).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NoteInput {
  text: string;
  is_blocker?: boolean;
  tag?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const notes: NoteInput[] = Array.isArray(body?.notes) ? body.notes : [];
    // Tone is fixed: all standups generate in professional tone.
    const format: string = body?.format === "ttb" ? "ttb" : "ytb";
    const userName: string | undefined = body?.userName;
    const mode: string = body?.mode === "weekly" ? "weekly" : "daily";

    if (!notes.length) {
      return new Response(JSON.stringify({ error: "No notes provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isYTB = format !== "ttb";
    const section1Key = isYTB ? "yesterday" : "today";
    const section2Key = isYTB ? "today" : "tomorrow";

    const noteLines = notes
      .map(
        (n) =>
          `- ${n.text}${n.is_blocker ? " [BLOCKER]" : ""}${n.tag ? ` (${n.tag})` : ""}`,
      )
      .join("\n");

    const toneGuide = `PROFESSIONAL TONE — write like a polished status update for a manager or client:
- Full, complete sentences in third-person or impersonal voice (avoid "I"/"we" where possible).
- No contractions ("I have" not "I've", "did not" not "didn't").
- Use precise engineering vocabulary ("Resolved", "Implemented", "Investigated", "Reviewed", "Deployed").
- Confident, formal, no slang or filler. Each bullet reads as a finished deliverable.`;

    const system =
      mode === "weekly"
        ? `You are an expert at writing concise weekly developer summaries. Tone: ${toneGuide}.${userName ? ` This is for ${userName}.` : ""}

CRITICAL REWRITING RULES:
- DO NOT echo the user's rough notes verbatim or with trivial rephrasing.
- GENUINELY rewrite each note into a polished, complete sentence using professional engineering vocabulary.
- Group related notes into a single bullet when possible.
- Expand terse phrases into clear outcomes (e.g. "fixed login bug" → "Resolved authentication bug affecting the user login flow").
- Never invent work that isn't grounded in the notes.
- Each bullet must start with "• " and read as a finished sentence (no fragments).`
        : `You are an expert at writing clear, polished developer standup updates. Tone: ${toneGuide}.${userName ? ` This is for ${userName}.` : ""}

CRITICAL REWRITING RULES:
- DO NOT echo the user's rough notes verbatim or with trivial rephrasing — that is a failure.
- GENUINELY rewrite every note into a clean, complete, professional sentence with proper engineering vocabulary.
- Examples of the transformation expected:
  • "fixed login bug" → "• Resolved authentication bug affecting the user login flow."
  • "pr review for jake" → "• Reviewed Jake's pull request and provided feedback."
  • "wip dashboard" → "• Continued progress on the dashboard implementation."
- Combine related notes into a single bullet when sensible.
- Each bullet starts with "• ", is a complete sentence ending with a period, and reads as something a manager would be proud to see.
- Never invent tasks not grounded in the notes.`;

    const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

    const yesterdayInstruction = isYTB
      ? `IMPORTANT — Section assignment:
- ALL of the notes below were captured TODAY (${todayLabel}). They MUST go into the "today" section.
- The "yesterday" section must NOT contain any of today's notes.
- Since no prior-day notes are provided, write a single reasonable inference bullet for "yesterday" such as "• Continued work on ongoing initiatives." or reference a project tag if obvious from today's notes (e.g. "• Continued progress on Frontend tasks."). Keep it to one short bullet.`
      : `IMPORTANT — Section assignment:
- ALL notes below were captured TODAY. Put them in the "today" section.
- The "tomorrow" section should be a brief, reasonable forward-looking bullet (e.g. "• Continue work on in-progress items and address open blockers.").`;

    const user = `Convert these rough notes into a structured standup.
Notes marked [BLOCKER] go ONLY in the blockers section (do not duplicate them in today/yesterday).
For each section, return bullet points joined by newlines, each starting with "• ".
If a section truly has no content, write a brief sensible single-line empty state.

${yesterdayInstruction}

Today's raw notes:
${noteLines}`;

    const tool = {
      type: "function",
      function: {
        name: "emit_standup",
        description: "Return the structured standup",
        parameters: {
          type: "object",
          properties: {
            [section1Key]: { type: "string", description: "Bullets joined by newlines" },
            [section2Key]: { type: "string", description: "Bullets joined by newlines" },
            blockers: { type: "string", description: "Bullets, or 'None'" },
            highlights: { type: "string", description: "One-sentence summary" },
          },
          required: [section1Key, section2Key, "blockers", "highlights"],
          additionalProperties: false,
        },
      },
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "emit_standup" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("Gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(call?.function?.arguments ?? "{}");
    } catch (e) {
      console.error("Failed to parse tool args", e);
    }

    // Normalise to a stable shape regardless of format
    const result = {
      yesterday: isYTB ? parsed[section1Key] ?? "" : "",
      today: parsed[isYTB ? "today" : "today"] ?? "",
      tomorrow: !isYTB ? parsed["tomorrow"] ?? "" : "",
      blockers: parsed.blockers ?? "None",
      highlights: parsed.highlights ?? "",
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-standup error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
