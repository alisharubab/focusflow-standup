import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import FFButton from "@/components/ff/FFButton";
import { Logo } from "@/components/ff/Logo";
import { PageTitle } from "@/components/ff/PageTitle";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  if (!loading && session) return <Navigate to="/app/today" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate("/app/today");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-secondary ff-dot-bg p-4">
      <PageTitle title="Sign in" />
      <div className="w-full max-w-[420px] bg-white rounded-xl shadow-ff-lg p-8 ff-fade-in">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>📋</span>
            <h1 className="font-display text-3xl text-foreground">FocusFlow</h1>
          </div>
          <p className="text-sm text-muted-foreground text-center">Turn rough notes into polished standups.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="ff-label">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ff-input"
              placeholder="you@team.com"
            />
          </div>
          <div>
            <label className="ff-label">Password</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ff-input pr-11"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground"
                aria-label="Toggle password"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {err && (
            <div className="bg-destructive-light text-destructive text-[13px] rounded-md px-3 py-2 border border-[hsl(0_60%_85%)]">
              {err}
            </div>
          )}

          <FFButton type="submit" size="lg" loading={busy} className="w-full">
            Sign in
          </FFButton>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Don't have an account?{" "}
          <Link to="/signup" className="text-highlight font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>

      <button
        type="button"
        onClick={() => setHowOpen(true)}
        className="mt-4 text-[13px] text-[hsl(var(--text-tertiary))] no-underline hover:underline"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        How it works
      </button>

      {howOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          style={{ animation: "ff-fade-in 200ms ease both" }}
          onClick={() => setHowOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-[480px] bg-white p-6"
            style={{ borderRadius: "var(--radius-lg, 14px)", boxShadow: "var(--shadow-lg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setHowOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 p-1.5 text-muted-foreground hover:text-foreground rounded-md"
            >
              <X size={16} />
            </button>
            <h2 className="font-display text-xl text-foreground mb-5 text-center">How it works</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { e: "📝", l: "Add notes", d: "Jot down what you worked on throughout the day" },
                { e: "✨", l: "Generate standup", d: "AI formats your notes into a polished update" },
                { e: "📋", l: "Copy to Slack", d: "Paste your standup in one click, ready to share" },
              ].map((s) => (
                <div key={s.l} className="flex flex-col items-center text-center">
                  <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>{s.e}</span>
                  <p className="mt-2 text-[13px] font-semibold text-foreground">{s.l}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground leading-snug">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
