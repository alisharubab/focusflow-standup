import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
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

function weekLabel(date: Date, today: Date) {
  const sow = startOfWeek(today);
  const lastWeek = new Date(sow); lastWeek.setDate(sow.getDate() - 7);
  const dStart = startOfWeek(date);
  if (dStart.getTime() === sow.getTime()) return "This week";
  if (dStart.getTime() === lastWeek.getTime()) return "Last week";
  const end = new Date(dStart); end.setDate(dStart.getDate() + 6);
  return `${dStart.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

function formatSlack(s: Standup) {
  return `*Yesterday*\n${s.yesterday || "—"}\n\n*Today*\n${s.today || "—"}\n\n*Blockers*\n${s.blockers || "None"}`;
}

export default function History() {
  const { user } = useAuth();
  const [items, setItems] = useState<Standup[]>([]);
  const [selected, setSelected] = useState<Standup | null>(null);
  const [range, setRange] = useState<"week" | "month" | "all">("month");
  const [q, setQ] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    if (!user) return;
    let query = supabase.from("standups").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (range !== "all") {
      const since = new Date();
      since.setDate(since.getDate() - (range === "week" ? 7 : 30));
      query = query.gte("created_at", since.toISOString());
    }
    const { data } = await query;
    setItems((data as Standup[]) ?? []);
  };
  useEffect(() => { load(); }, [user, range]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const ql = q.toLowerCase();
    return items.filter((s) =>
      [s.yesterday, s.today, s.blockers, s.highlights].some((f) => (f || "").toLowerCase().includes(ql)),
    );
  }, [items, q]);

  const today = new Date();
  const grouped = useMemo(() => {
    const map = new Map<string, Standup[]>();
    filtered.forEach((s) => {
      const key = weekLabel(new Date(s.created_at), today);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const del = async () => {
    if (!selected) return;
    await supabase.from("standups").delete().eq("id", selected.id);
    setItems((a) => a.filter((x) => x.id !== selected.id));
    setSelected(null);
    setConfirmDel(false);
    toast.success("Standup deleted");
  };

  const copy = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(formatSlack(selected));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="p-6 md:p-8">
      <PageTitle title="History" />
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="inline-flex bg-bg-secondary p-1 rounded-full">
          {(["week", "month", "all"] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium capitalize transition ${range === r ? "bg-white shadow-ff-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {r === "week" ? "This week" : r === "month" ? "This month" : "All time"}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search standups…" className="ff-input pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        <div className="space-y-6">
          {grouped.length === 0 && (
            <div className="ff-card p-8 text-center text-muted-foreground text-sm">
              <svg width="48" height="48" viewBox="0 0 48 48" className="mx-auto mb-3 text-text-tertiary" fill="none">
                <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M24 14v10l6 4" stroke="hsl(var(--highlight))" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              No standups yet — generate one from your notes.
            </div>
          )}
          {grouped.map(([label, arr]) => (
            <div key={label}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">{label}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-2">
                {arr.map((s) => {
                  const d = new Date(s.created_at);
                  const isSel = selected?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className={`w-full text-left ff-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-ff-md ${isSel ? "border-highlight ring-2 ring-highlight/20" : ""}`}
                    >
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <h4 className="font-display text-[16px]">{d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</h4>
                        <span className="text-[12px] text-text-tertiary">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                      </div>
                      <p className="text-[13px] text-muted-foreground line-clamp-1">{(s.today || s.yesterday || "—").replace(/\n/g, " ")}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex px-2 py-0.5 rounded-full border border-border text-[10px] capitalize text-muted-foreground">{s.tone}</span>
                        {s.edited && <span className="text-[10px] text-text-tertiary">edited</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          {!selected && (
            <div className="ff-card p-10 text-center text-muted-foreground text-sm">
              Select a standup to view it.
            </div>
          )}
          {selected && (
            <div key={selected.id} className="ff-card p-7 ff-fade-in">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-display text-[22px]">{new Date(selected.created_at).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</h3>
                  <p className="font-mono text-[12px] text-text-tertiary">{new Date(selected.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <FFButton variant="highlight" size="sm" onClick={copy}>
                    {copied ? <><Check size={14}/> Copied</> : "Copy"}
                  </FFButton>
                  <div className="relative">
                    <button onClick={() => setConfirmDel(!confirmDel)} className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border text-destructive hover:bg-destructive-light transition">
                      <Trash2 size={14}/>
                    </button>
                    {confirmDel && (
                      <div className="absolute right-0 mt-2 z-30 bg-white border border-border rounded-lg shadow-ff-md p-3 w-56 ff-slide-up">
                        <p className="text-[13px] mb-3">Delete this standup?</p>
                        <div className="flex gap-2 justify-end">
                          <FFButton variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>Cancel</FFButton>
                          <FFButton variant="danger" size="sm" onClick={del}>Delete</FFButton>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {[
                { label: "Yesterday", value: selected.yesterday, c: "hsl(var(--success))" },
                { label: "Today", value: selected.today, c: "hsl(var(--highlight))" },
                { label: "Blockers", value: selected.blockers, c: "hsl(var(--destructive))" },
              ].map((sec) => (
                <div key={sec.label} className="pl-4 border-l-[3px] mb-4" style={{ borderColor: sec.c }}>
                  <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">{sec.label}</h4>
                  <p className="text-[14px] leading-[1.7] whitespace-pre-wrap">{sec.value || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
