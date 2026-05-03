import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Check, ArrowLeft, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FFButton from "@/components/ff/FFButton";
import { PageTitle } from "@/components/ff/PageTitle";
import { Standup } from "@/types/ff";

function formatSlack(s: Standup) {
  const fmt = (label: string, body: string | null) =>
    `*${label}*\n${(body || "—").trim()}`;
  return [
    fmt("Yesterday", s.yesterday),
    fmt("Today", s.today),
    fmt("Blockers", s.blockers || "None"),
  ].join("\n\n");
}

export default function Output() {
  const [params] = useSearchParams();
  const id = params.get("id");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [s, setS] = useState<Standup | null>(null);
  const [tone, setTone] = useState<"casual" | "professional">("professional");
  const [copied, setCopied] = useState(false);
  const [regen, setRegen] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    supabase.from("standups").select("*").eq("id", id).single()
      .then(({ data }) => {
        if (data) {
          setS(data as Standup);
          setTone((data as Standup).tone === "casual" ? "casual" : "professional");
        }
      });
  }, [id, user]);

  const update = (patch: Partial<Standup>) => {
    if (!s) return;
    const next = { ...s, ...patch, edited: true };
    setS(next);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      await supabase.from("standups").update({
        yesterday: next.yesterday,
        today: next.today,
        blockers: next.blockers,
        highlights: next.highlights,
        tone: next.tone,
        edited: true,
      }).eq("id", next.id);
    }, 1500);
  };

  const copy = async () => {
    if (!s) return;
    await navigator.clipboard.writeText(formatSlack(s));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const regenerate = async (overrideTone?: "casual" | "professional") => {
    if (!s || !user) return;
    const useTone = overrideTone ?? tone;
    setRegen(true);
    const ids = s.raw_note_ids ?? [];
    const { data: ns } = await supabase.from("notes").select("*, project_tags(name)").in("id", ids);
    const notes = (ns as any[] ?? []).map((n) => ({ text: n.text, is_blocker: n.is_blocker, tag: n.project_tags?.name ?? null }));
    if (notes.length === 0) { setRegen(false); toast.error("Original notes are gone"); return; }
    const { data: profile } = await supabase.from("profiles").select("standup_format, name_in_standup, full_name").eq("id", user.id).maybeSingle();
    const { data, error } = await supabase.functions.invoke("generate-standup", {
      body: {
        notes,
        tone: useTone,
        format: profile?.standup_format || "ytb",
        userName: profile?.name_in_standup ? profile?.full_name : undefined,
      },
    });
    setRegen(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || "Failed"); return; }
    const r = data as any;
    const next = { ...s, yesterday: r.yesterday, today: r.today || r.tomorrow, blockers: r.blockers, highlights: r.highlights, tone: useTone, edited: false } as Standup;
    setS(next);
    await supabase.from("standups").update({
      yesterday: next.yesterday, today: next.today, blockers: next.blockers, highlights: next.highlights, tone: useTone, edited: false
    }).eq("id", next.id);
    toast.success("Regenerated");
  };

  if (!s) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  const sections = [
    { key: "yesterday" as const, label: "Yesterday", color: "hsl(var(--success))", value: s.yesterday },
    { key: "today" as const, label: "Today", color: "hsl(var(--highlight))", value: s.today },
    { key: "blockers" as const, label: "Blockers", color: "hsl(var(--destructive))", value: s.blockers },
  ];

  return (
    <div className="p-6 md:p-10">
      <PageTitle title="Your standup" />
      <div className="max-w-[680px] mx-auto ff-card shadow-ff-lg p-7 md:p-10 ff-slide-up">
        <div className="flex items-start justify-between mb-1 gap-4 flex-wrap">
          <h2 className="font-display text-[26px]">Your standup is ready</h2>
        </div>
        <p className="font-mono text-[12px] text-text-tertiary mb-5">
          {new Date(s.created_at).toLocaleString(undefined, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>

        <div className="inline-flex items-center bg-bg-secondary p-1 rounded-full mb-7">
          {(["casual", "professional"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { if (t === tone || regen) return; setTone(t); regenerate(t); }}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium capitalize transition ${
                tone === t ? "bg-highlight text-white shadow-ff-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {sections.map((sec) => (
            <div key={sec.key} className="pl-4 border-l-[3px]" style={{ borderColor: sec.color }}>
              <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">{sec.label}</h3>
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => update({ [sec.key]: e.currentTarget.innerText } as any)}
                className="text-[15px] leading-[1.7] text-foreground whitespace-pre-wrap focus:outline-none focus:bg-highlight-light/40 rounded-md px-2 py-1 -mx-2 transition"
              >
                {sec.value || (sec.key === "blockers" ? "None" : "—")}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-8 gap-3 flex-wrap">
          <button onClick={() => navigate("/app/today")} className="inline-flex items-center gap-1.5 text-[13px] text-text-tertiary hover:text-foreground transition">
            <ArrowLeft size={14} /> Back to notes
          </button>
          <div className="flex items-center gap-2">
            <FFButton variant="ghost" size="md" onClick={() => regenerate()} loading={regen}>
              <RotateCcw size={14} /> Regenerate
            </FFButton>
            <FFButton variant="highlight" size="md" onClick={copy}>
              {copied ? <><Check size={14} /> Copied!</> : "Copy to clipboard"}
            </FFButton>
          </div>
        </div>
      </div>
    </div>
  );
}
