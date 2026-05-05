import { ReactNode, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, Clock, BarChart3, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/ff/Logo";
import { DEFAULT_AVATAR, avatarBg } from "@/lib/avatars";

const nav = [
  { to: "/app/today", icon: Home, label: "Today" },
  { to: "/app/history", icon: Clock, label: "History" },
  { to: "/app/summary", icon: BarChart3, label: "Weekly Summary" },
  { to: "/app/settings", icon: Settings, label: "Settings" },
];

const titles: Record<string, string> = {
  "/app/today": "Today",
  "/app/output": "Your standup",
  "/app/history": "History",
  "/app/summary": "Weekly Summary",
  "/app/settings": "Settings",
};

function initialsOf(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+|@/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name,avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        setProfileName(data?.full_name ?? null);
        if (data?.avatar_url) setAvatar(data.avatar_url);
      });
    const channel = supabase.channel(`profile-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload: any) => {
          setProfileName(payload.new?.full_name ?? null);
          if (payload.new?.avatar_url) setAvatar(payload.new.avatar_url);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const title = titles[pathname] || "FocusFlow";
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside className="w-[240px] shrink-0 bg-bg-secondary border-r border-border flex flex-col fixed inset-y-0 left-0 hidden md:flex">
        <div className="p-5">
          <Logo size={18} />
        </div>

        <NavLink
          to="/app/settings"
          aria-label="Open profile settings"
          className="px-4 py-3 mx-3 mb-2 rounded-md bg-white/60 border border-border flex items-center gap-3 cursor-pointer transition-colors duration-150 hover:bg-bg-tertiary"
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-[18px] border border-border"
            style={{ backgroundColor: avatarBg(avatar) ?? undefined }}
            aria-label="Avatar"
          >
            {avatar}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium truncate">{profileName || "Welcome"}</div>
            <div className="text-[11px] text-text-tertiary truncate">{user?.email}</div>
          </div>
        </NavLink>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/app/today"}
              className={({ isActive }) =>
                `flex items-center gap-3 h-10 px-3 rounded-lg text-[14px] transition-all duration-150 relative ${
                  isActive
                    ? "bg-highlight-light text-highlight font-medium"
                    : "text-muted-foreground hover:bg-bg-tertiary"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-highlight" />}
                  <n.icon size={16} />
                  <span>{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-[13px] text-text-tertiary hover:text-foreground transition"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 md:ml-[240px] min-w-0 flex flex-col">
        <header className="h-14 bg-white border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
          <h1 className="font-display text-[22px] text-foreground">{title}</h1>
          <span className="font-mono text-[13px] text-text-tertiary">{dateLabel}</span>
        </header>
        <div key={pathname} className="flex-1 ff-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
