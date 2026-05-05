import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FFButton from "@/components/ff/FFButton";
import { PageTitle } from "@/components/ff/PageTitle";
import { TagPill } from "@/components/ff/TagPill";
import { Note, Tag } from "@/types/ff";

function todayISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

export default function Today() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tags, setTags] = useState<Tag[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [tagId, setTagId] = useState<string | null>(null);
  const [isBlocker, setIsBlocker] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const wordCount = useMemo(() => text.trim() ? text.trim().split(/\s+/).length : 0, [text]);

  const load = async () => {
    if (!user) return;
    const since = todayISO();
    const [{ data: ts }, { data: ns }] = await Promise.all([
      supabase.from("project_tags").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("notes").select("*").eq("user_id", user.id).gte("created_at", since).order("created_at", { ascending: false }),
    ]);
    setTags((ts as Tag[]) ?? []);
    setNotes((ns as Note[]) ?? []);
  };

  useEffect(() => { load(); }, [user]);

  // Auto-grow textarea
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 240) + "px";
  }, [text]);

  const selectedTag = useMemo(() => tags.find(t => t.id === tagId) ?? null, [tags, tagId]);

  const addNote = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || !user) return;
    const optimistic: Note = {
      id: `tmp-${Date.now()}`,
      text: text.trim(),
      tag_id: tagId,
      is_blocker: isBlocker,
      created_at: new Date().toISOString(),
    };
    setNotes((n) => [optimistic, ...n]);
    const t = text;
    setText("");
    setIsBlocker(false);

    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: user.id, text: t.trim(), tag_id: tagId, is_blocker: optimistic.is_blocker })
      .select()
      .single();

    if (error) {
      setNotes((n) => n.filter((x) => x.id !== optimistic.id));
      toast.error("Couldn't save note");
    } else if (data) {
      setNotes((n) => n.map((x) => (x.id === optimistic.id ? (data as Note) : x)));
    }
  };

  const removeNote = async (id: string) => {
    setNotes((n) => n.filter((x) => x.id !== id));
    await supabase.from("notes").delete().eq("id", id);
  };

  const generate = async () => {
    if (notes.length === 0 || !user) return;
    setGenerating(true);
    const { data: profile } = await supabase
      .from("profiles").select("standup_format, name_in_standup, full_name")
      .eq("id", user.id).maybeSingle();

    const payload = {
      notes: notes.map((n) => ({
        text: n.text,
        is_blocker: n.is_blocker,
        tag: tags.find((t) => t.id === n.tag_id)?.name ?? null,
      })),
      format: profile?.standup_format || "ytb",
      userName: profile?.name_in_standup ? profile?.full_name : undefined,
    };

    const { data, error } = await supabase.functions.invoke("generate-standup", { body: payload });
    if (error || !data || (data as any).error) {
      setGenerating(false);
      const msg = (data as any)?.error || error?.message || "Generation failed";
      if ((error as any)?.status === 429 || msg.toLowerCase().includes("rate")) toast.error("Rate limit reached. Try again shortly.");
      else if ((error as any)?.status === 402 || msg.toLowerCase().includes("credit")) toast.error("AI credits exhausted.");
      else toast.error(msg);
      return;
    }

    const r = data as any;
    const { data: standup, error: insErr } = await supabase
      .from("standups")
      .insert({
        user_id: user.id,
        yesterday: r.yesterday || null,
        today: r.today || r.tomorrow || null,
        blockers: r.blockers || "None",
        highlights: r.highlights || null,
        raw_note_ids: notes.filter(n => !n.id.startsWith("tmp-")).map(n => n.id),
      })
      .select()
      .single();

    setGenerating(false);
    if (insErr || !standup) {
      toast.error("Couldn't save standup");
      return;
    }
    navigate(`/app/output?id=${standup.id}`);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <PageTitle title="Today" />
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 ff-stagger">
        {/* Input */}
        <section>
          <div className="mb-4">
            <h2 className="font-display text-[22px] text-foreground">Today's notes</h2>
            <p className="text-[13px] text-text-tertiary">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>

          <form onSubmit={addNote} className="ff-card p-4 space-y-3">
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              rows={3}
              placeholder="What did you work on? Type a quick note..."
              className="ff-input resize-none text-[15px] leading-relaxed border-0 shadow-none focus:ring-0 focus:border-transparent p-0"
            />
            {focused && wordCount > 0 && (
              <div className="-mt-1 text-right font-mono text-[12px] text-text-tertiary">
                {wordCount} {wordCount === 1 ? "word" : "words"}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTagOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-bg-secondary text-[12px] font-medium text-foreground hover:bg-bg-tertiary transition"
                  >
                    {selectedTag ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedTag.color }} />
                        {selectedTag.name}
                      </>
                    ) : (
                      <>No tag</>
                    )}
                    <ChevronDown size={12} />
                  </button>
                  {tagOpen && (
                    <div className="absolute z-30 mt-2 w-56 bg-white border border-border rounded-lg shadow-ff-md p-1.5 ff-slide-up">
                      <button type="button" onClick={() => { setTagId(null); setTagOpen(false); }} className="w-full text-left px-2 py-1.5 rounded-md text-[13px] hover:bg-bg-secondary">No tag</button>
                      {tags.map((t) => (
                        <button key={t.id} type="button" onClick={() => { setTagId(t.id); setTagOpen(false); }}
                                className="w-full text-left px-2 py-1.5 rounded-md text-[13px] hover:bg-bg-secondary flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.name}
                        </button>
                      ))}
                      <div className="border-t border-border mt-1 pt-1">
                        <button type="button" onClick={() => { setTagOpen(false); navigate("/app/settings"); }} className="w-full text-left px-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:bg-bg-secondary">+ New tag…</button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsBlocker(!isBlocker)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] font-medium transition ${
                    isBlocker
                      ? "bg-destructive-light border-[hsl(0_60%_85%)] text-destructive"
                      : "bg-bg-secondary border-border text-muted-foreground hover:bg-bg-tertiary"
                  }`}
                >
                  <AlertTriangle size={12} /> Blocker
                </button>
              </div>

              <FFButton type="submit" variant="highlight" size="sm" disabled={!text.trim()}>
                Add note
              </FFButton>
            </div>
          </form>

          {/* Notes list */}
          <div className="mt-6 space-y-3">
            {notes.length === 0 && (
              <div className="ff-card p-8 text-center">
                <svg width="56" height="56" viewBox="0 0 56 56" className="mx-auto mb-3 text-text-tertiary" fill="none">
                  <rect x="10" y="8" width="32" height="40" rx="4" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M16 18h20M16 26h20M16 34h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M40 6l4 4-12 12-5 1 1-5L40 6z" stroke="hsl(var(--highlight))" strokeWidth="1.5" strokeLinejoin="round" fill="hsl(var(--highlight-light))"/>
                </svg>
                <p className="text-muted-foreground text-sm">No notes yet — add your first one above.</p>
              </div>
            )}
            {notes.map((n) => {
              const tag = tags.find((t) => t.id === n.tag_id) ?? null;
              return (
                <div key={n.id} className="ff-card p-4 group ff-slide-up relative">
                  <p className="text-[14px] leading-relaxed text-foreground whitespace-pre-wrap">{n.text}</p>
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <div className="flex items-center gap-2">
                      {tag && <TagPill tag={tag} small />}
                      {n.is_blocker && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-destructive-light text-destructive border border-[hsl(0_60%_85%)]">
                          <AlertTriangle size={10} /> Blocker
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-text-tertiary">
                      {new Date(n.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <button
                    onClick={() => removeNote(n.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-bg-secondary text-text-tertiary"
                    aria-label="Delete"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Generate column */}
        <section className="lg:sticky lg:top-20 lg:self-start">
          <div className="ff-card p-6">
            <h3 className="font-display text-[20px] mb-2">Ready to wrap up?</h3>
            <p className="text-[13px] text-muted-foreground mb-5">
              FocusFlow turns your notes into a polished standup you can paste into Slack.
            </p>
            <div className="text-[13px] text-muted-foreground mb-5 flex items-center justify-between">
              <span>Notes today</span>
              <span className="font-mono text-foreground">{notes.length}</span>
            </div>
            <FFButton
              variant="primary"
              size="lg"
              className="w-full"
              disabled={notes.length === 0 || generating}
              loading={generating}
              onClick={generate}
              title={notes.length === 0 ? "Add at least one note first" : ""}
            >
              {generating ? "Generating…" : "Generate Standup →"}
            </FFButton>
          </div>
        </section>
      </div>
    </div>
  );
}
