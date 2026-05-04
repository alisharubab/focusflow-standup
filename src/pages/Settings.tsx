import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FFButton from "@/components/ff/FFButton";
import { PageTitle } from "@/components/ff/PageTitle";
import { Profile, Tag } from "@/types/ff";
import { AVATARS, DEFAULT_AVATAR, avatarBg } from "@/lib/avatars";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Standup preferences" },
  { id: "tags", label: "Project tags" },
  { id: "data", label: "Data & account" },
];

const SWATCHES = ["#5B4FE8", "#2A7A5A", "#8A5C00", "#8A2020", "#1A1A2E", "#0E7490", "#B45309", "#7C3AED"];

function initialsOf(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+|@/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [original, setOriginal] = useState<Profile | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [delConfirm, setDelConfirm] = useState<{ kind: string; text: string } | null>(null);

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { data: ts }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("project_tags").select("*").eq("user_id", user.id).order("created_at"),
    ]);
    if (p) { setProfile(p as Profile); setOriginal(p as Profile); }
    setTags((ts as Tag[]) ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const dirty = useMemo(() => JSON.stringify(profile) !== JSON.stringify(original), [profile, original]);

  const save = async () => {
    if (!profile || !user) return;
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name,
      job_title: profile.job_title,
      team_name: profile.team_name,
      default_tone: profile.default_tone,
      standup_format: profile.standup_format,
      name_in_standup: profile.name_in_standup,
      avatar_url: profile.avatar_url,
    }).eq("id", user.id);
    if (error) toast.error("Couldn't save");
    else { toast.success("Saved"); setOriginal(profile); }
  };

  const addTag = async () => {
    if (!user || !newTagName.trim()) return;
    const { data, error } = await supabase.from("project_tags").insert({ user_id: user.id, name: newTagName.trim(), color: SWATCHES[tags.length % SWATCHES.length] }).select().single();
    if (!error && data) setTags((t) => [...t, data as Tag]);
    setNewTagName("");
  };

  const updateTag = async (id: string, patch: Partial<Tag>) => {
    setTags((t) => t.map((x) => x.id === id ? { ...x, ...patch } : x));
    await supabase.from("project_tags").update(patch).eq("id", id);
  };

  const deleteTag = async (id: string) => {
    const { count } = await supabase.from("notes").select("*", { count: "exact", head: true }).eq("tag_id", id);
    if ((count ?? 0) > 0 && !window.confirm(`${count} notes use this tag — delete anyway?`)) return;
    await supabase.from("project_tags").delete().eq("id", id);
    setTags((t) => t.filter((x) => x.id !== id));
  };

  const exportData = async () => {
    if (!user) return;
    const [{ data: notes }, { data: standups }, { data: ts }] = await Promise.all([
      supabase.from("notes").select("*").eq("user_id", user.id),
      supabase.from("standups").select("*").eq("user_id", user.id),
      supabase.from("project_tags").select("*").eq("user_id", user.id),
    ]);
    const blob = new Blob([JSON.stringify({ notes, standups, tags: ts, exported_at: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `focusflow-export-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported");
  };

  const deleteAllStandups = async () => {
    if (!user) return;
    await supabase.from("standups").delete().eq("user_id", user.id);
    toast.success("All standups deleted");
    setDelConfirm(null);
  };

  if (!profile) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 md:p-8">
      <PageTitle title="Settings" />
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 max-w-5xl">
        <nav className="space-y-1">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setTab(s.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-[13px] transition ${tab === s.id ? "bg-highlight-light text-highlight font-medium" : "text-muted-foreground hover:bg-bg-secondary"}`}>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="space-y-6 ff-fade-in">
          {tab === "profile" && (
            <div className="ff-card p-6">
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-[40px] border border-border"
                  style={{ backgroundColor: avatarBg(profile.avatar_url) ?? undefined }}
                >
                  {profile.avatar_url || DEFAULT_AVATAR}
                </div>
                <div>
                  <h3 className="font-display text-[20px]">{profile.full_name || user?.email}</h3>
                  <p className="text-[13px] text-text-tertiary">{user?.email}</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="ff-label">Avatar</label>
                <div className="flex gap-3">
                  {AVATARS.map((a) => {
                    const selected = (profile.avatar_url || DEFAULT_AVATAR) === a.emoji;
                    return (
                      <button
                        key={a.emoji}
                        type="button"
                        onClick={() => setProfile({ ...profile, avatar_url: a.emoji })}
                        className={`w-16 h-16 rounded-full flex items-center justify-center text-[32px] border border-border transition ${selected ? "ring-2 ring-offset-2" : "hover:scale-105"}`}
                        style={{
                          backgroundColor: a.bg,
                          ...(selected ? { boxShadow: `0 0 0 2px hsl(var(--highlight))` } : {}),
                        }}
                        aria-label={`Select ${a.emoji}`}
                      >
                        {a.emoji}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="ff-label">Full name</label>
                  <input className="ff-input" value={profile.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
                </div>
                <div>
                  <label className="ff-label">Job title</label>
                  <input className="ff-input" value={profile.job_title ?? ""} onChange={(e) => setProfile({ ...profile, job_title: e.target.value })} placeholder="Senior Engineer" />
                </div>
                <div>
                  <label className="ff-label">Team name</label>
                  <input className="ff-input" value={profile.team_name ?? ""} onChange={(e) => setProfile({ ...profile, team_name: e.target.value })} placeholder="Platform" />
                </div>
                <div>
                  <label className="ff-label">Email</label>
                  <input className="ff-input bg-bg-secondary" value={user?.email ?? ""} readOnly />
                </div>
              </div>

              {dirty && (
                <div className="mt-5 flex justify-end">
                  <FFButton onClick={save}>Save changes</FFButton>
                </div>
              )}
            </div>
          )}

          {tab === "preferences" && (
            <div className="ff-card p-6 space-y-6">
              <div>
                <label className="ff-label">Default tone</label>
                <div className="inline-flex bg-bg-secondary p-1 rounded-full">
                  {(["casual", "professional"] as const).map((t) => (
                    <button key={t} onClick={() => setProfile({ ...profile, default_tone: t })}
                      className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium capitalize transition ${profile.default_tone === t ? "bg-highlight text-white" : "text-muted-foreground"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="ff-label">Standup format</label>
                <div className="inline-flex bg-bg-secondary p-1 rounded-full">
                  {[{ id: "ytb", label: "Yesterday / Today / Blockers" }, { id: "ttb", label: "Today / Tomorrow / Blockers" }].map((f) => (
                    <button key={f.id} onClick={() => setProfile({ ...profile, standup_format: f.id })}
                      className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition ${profile.standup_format === f.id ? "bg-highlight text-white" : "text-muted-foreground"}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-medium">Include your name</p>
                  <p className="text-[12px] text-text-tertiary">Adds "Here's [Name]'s update:" to the header</p>
                </div>
                <button onClick={() => setProfile({ ...profile, name_in_standup: !profile.name_in_standup })}
                  className={`w-11 h-6 rounded-full p-0.5 transition ${profile.name_in_standup ? "bg-highlight" : "bg-border-strong"}`}>
                  <span className={`block w-5 h-5 rounded-full bg-white shadow-ff-sm transition-transform ${profile.name_in_standup ? "translate-x-5" : ""}`} />
                </button>
              </div>
              {dirty && (
                <div className="flex justify-end">
                  <FFButton onClick={save}>Save changes</FFButton>
                </div>
              )}
            </div>
          )}

          {tab === "tags" && (
            <div className="ff-card p-6">
              <div className="space-y-3">
                {tags.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setColorPickerFor(colorPickerFor === t.id ? null : t.id)}
                        className="w-6 h-6 rounded-full border border-border"
                        style={{ backgroundColor: t.color }}
                        aria-label="Change color"
                      />
                      {colorPickerFor === t.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setColorPickerFor(null)} />
                          <div className="absolute z-20 left-0 top-full mt-2 flex bg-white border border-border rounded-lg p-2 gap-1.5 shadow-ff-md ff-slide-up">
                            {SWATCHES.map((c) => (
                              <button key={c} onClick={() => { updateTag(t.id, { color: c }); setColorPickerFor(null); }} className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    {editingTag === t.id ? (
                      <input autoFocus value={t.name} onBlur={() => setEditingTag(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingTag(null)}
                        onChange={(e) => updateTag(t.id, { name: e.target.value })}
                        className="ff-input flex-1 h-8" />
                    ) : (
                      <button onClick={() => setEditingTag(t.id)} className="flex-1 text-left text-[14px] font-medium">{t.name}</button>
                    )}
                    <button onClick={() => setEditingTag(t.id)} className="p-1.5 text-text-tertiary hover:text-foreground rounded"><Pencil size={14}/></button>
                    <button onClick={() => deleteTag(t.id)} className="p-1.5 text-destructive hover:bg-destructive-light rounded"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} className="ff-input flex-1" placeholder="New tag name" />
                <FFButton variant="ghost" onClick={addTag}><Plus size={14}/> Add</FFButton>
              </div>
            </div>
          )}

          {tab === "data" && (
            <div className="space-y-4">
              <div className="ff-card p-6">
                <h3 className="font-display text-[18px] mb-1">Export your data</h3>
                <p className="text-[13px] text-muted-foreground mb-4">Download all your notes, standups, and tags as JSON.</p>
                <FFButton variant="ghost" onClick={exportData}>Export my data</FFButton>
              </div>
              <div className="ff-card p-6 border-destructive/40">
                <h3 className="font-display text-[18px] mb-1 text-destructive">Danger zone</h3>
                <p className="text-[13px] text-muted-foreground mb-4">These actions cannot be undone.</p>
                {!delConfirm && (
                  <FFButton variant="danger" onClick={() => setDelConfirm({ kind: "standups", text: "" })}>Delete all standups</FFButton>
                )}
                {delConfirm?.kind === "standups" && (
                  <div className="space-y-2 ff-slide-up">
                    <p className="text-[13px]">Type <span className="font-mono font-bold">DELETE</span> to confirm.</p>
                    <input className="ff-input" value={delConfirm.text} onChange={(e) => setDelConfirm({ ...delConfirm, text: e.target.value })} />
                    <div className="flex gap-2">
                      <FFButton variant="ghost" size="sm" onClick={() => setDelConfirm(null)}>Cancel</FFButton>
                      <FFButton variant="danger" size="sm" disabled={delConfirm.text !== "DELETE"} onClick={deleteAllStandups}>Confirm delete</FFButton>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
