import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary ff-dot-bg p-4">
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
    </div>
  );
}
