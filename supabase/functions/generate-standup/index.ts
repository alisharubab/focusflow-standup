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
    const tone: string = body?.tone === "casual" ? "casual" : "professional";
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

    const system =
      mode === "weekly"
        ? `You are an expert at writing concise weekly developer summaries. Tone: ${tone}.${userName ? ` This is for ${userName}.` : ""} Group similar notes. Keep bullets under 18 words. Never invent tasks.`
        : `You are an expert at writing clear, concise developer standup updates. Tone: ${tone === "casual" ? "conversational, friendly, natural" : "professional, clear, full sentences"}.${userName ? ` This is for ${userName}.` : ""} Never invent tasks. Keep bullets under 15 words.`;

    const user = `Convert these rough notes into a structured standup.
Notes marked [BLOCKER] go in the blockers section.
For each section, return bullet points joined by newlines, each starting with "• ".
If a section has no content, return a brief sensible empty state line.

Notes:
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
