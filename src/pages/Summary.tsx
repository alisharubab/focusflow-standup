import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FFButton from "@/components/ff/FFButton";
import { PageTitle } from "@/components/ff/PageTitle";
import { Standup } from "@/types/ff";

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

export default function Summary() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const sow = startOfWeek(new Date());
  const eow = new Date(sow); eow.setDate(sow.getDate() + 4); // Mon..Fri

  const [weekStandups, setWeekStandups] = useState<Standup[]>([]);
  const [summary, setSummary] = useState<{ yesterday?: string; today?: string; blockers?: string; highlights?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const eowFull = new Date(sow); eowFull.setDate(sow.getDate() + 7);
    supabase.from("standups").select("*").eq("user_id", user.id)
      .gte("created_at", sow.toISOString()).lt("created_at", eowFull.toISOString())
      .then(({ data }) => setWeekStandups((data as Standup[]) ?? []));
  }, [user]);

  const dayHasStandup = (i: number) => {
    const d = new Date(sow); d.setDate(sow.getDate() + i);
    return weekStandups.find((s) => {
      const sd = new Date(s.created_at);
      return sd.getDate() === d.getDate() && sd.getMonth() === d.getMonth();
    });
  };

  const generate = async () => {
    if (weekStandups.length === 0 || !user) return;
    setBusy(true);
    // Aggregate notes from all standups this week into a single set
    const noteIds = weekStandups.flatMap((s) => s.raw_note_ids ?? []);
    const { data: ns } = await supabase.from("notes").select("*, project_tags(name)").in("id", noteIds);
    const notes = (ns as any[] ?? []).map((n) => ({ text: n.text, is_blocker: n.is_blocker, tag: n.project_tags?.name ?? null }));
    if (notes.length === 0) {
      // fallback: pull all notes from this week
      const eowFull = new Date(sow); eowFull.setDate(sow.getDate() + 7);
      const { data: weekNotes } = await supabase.from("notes").select("*, project_tags(name)").eq("user_id", user.id)
        .gte("created_at", sow.toISOString()).lt("created_at", eowFull.toISOString());
      (weekNotes as any[] ?? []).forEach((n) => notes.push({ text: n.text, is_blocker: n.is_blocker, tag: n.project_tags?.name ?? null }));
    }

    const { data: profile } = await supabase.from("profiles").select("default_tone").eq("id", user.id).maybeSingle();
    const { data, error } = await supabase.functions.invoke("generate-standup", {
      body: { notes, tone: profile?.default_tone || "professional", format: "ytb", mode: "weekly" },
    });
    setBusy(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || "Failed"); return; }
    setSummary(data as any);
  };

  const copy = async () => {
    if (!summary) return;
    const text = `*Weekly Update — ${sow.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${eow.toLocaleDateString(undefined, { day: "numeric", month: "short" })}*\n\n*Highlights*\n${summary.highlights || "—"}\n\n*Done*\n${summary.yesterday || summary.today || "—"}\n\n*Up next*\n${summary.today || "—"}\n\n*Blockers*\n${summary.blockers || "None"}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  return (
    <div className="p-6 md:p-10">
      <PageTitle title="Weekly Summary" />
      <div className="max-w-[720px] mx-auto ff-stagger">
        <h2 className="font-display text-[28px] mb-1">
          Week of {sow.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – {eow.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </h2>
        <p className="text-[13px] text-text-tertiary mb-6">A bird's-eye view of your week.</p>

        <div className="ff-card p-6 mb-6">
          <div className="grid grid-cols-5 gap-2 mb-6">
            {days.map((d, i) => {
              const has = dayHasStandup(i);
              return (
                <button key={d}
                  onClick={() => has && navigate("/app/history")}
                  className="flex flex-col items-center gap-2 py-3 rounded-lg hover:bg-bg-secondary transition"
                  disabled={!has}
                >
                  <span className="text-[12px] font-medium text-muted-foreground">{d}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${has ? "bg-highlight" : "border border-border-strong"}`} />
                </button>
              );
            })}
          </div>
          <FFButton variant="primary" size="lg" className="w-full" onClick={generate} loading={busy} disabled={weekStandups.length === 0}>
            {busy ? "Generating…" : "Generate This Week's Summary"}
          </FFButton>
          {weekStandups.length === 0 && (
            <p className="text-[12px] text-text-tertiary mt-3 text-center">No standups this week yet.</p>
          )}
        </div>

        {summary && (
          <div className="ff-card p-7 ff-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-[22px]">Your week, summarised</h3>
              <FFButton variant="highlight" size="sm" onClick={copy}>
                {copied ? <><Check size={14}/> Copied</> : "Copy"}
              </FFButton>
            </div>

            {summary.highlights && (
              <div className="pl-4 border-l-[3px] mb-4" style={{ borderColor: "hsl(var(--warning))" }}>
                <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Highlights</h4>
                <p className="text-[15px] leading-[1.7] italic">{summary.highlights}</p>
              </div>
            )}
            {[
              { label: "Done", value: summary.yesterday || summary.today, c: "hsl(var(--success))" },
              { label: "Up next", value: summary.today, c: "hsl(var(--highlight))" },
              { label: "Blockers", value: summary.blockers, c: "hsl(var(--destructive))" },
            ].map((sec) => (
              <div key={sec.label} className="pl-4 border-l-[3px] mb-4" style={{ borderColor: sec.c }}>
                <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">{sec.label}</h4>
                <p className="text-[15px] leading-[1.7] whitespace-pre-wrap">{sec.value || "—"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
