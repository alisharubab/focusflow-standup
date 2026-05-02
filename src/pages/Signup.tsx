import { useMemo, useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import FFButton from "@/components/ff/FFButton";
import { PageTitle } from "@/components/ff/PageTitle";
import { useAuth } from "@/contexts/AuthContext";

function strength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export default function Signup() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const s = useMemo(() => strength(pw), [pw]);
  const sLabel = ["Too weak", "Weak", "Okay", "Strong", "Excellent"][s];
  const sColor = ["bg-bg-tertiary", "bg-destructive", "bg-warning", "bg-highlight", "bg-success"][s];

  if (!loading && session) return <Navigate to="/app/today" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw !== pw2) { setErr("Passwords don't match"); return; }
    if (pw.length < 8) { setErr("Password must be at least 8 characters"); return; }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: pw,
      options: {
        emailRedirectTo: `${window.location.origin}/app/today`,
        data: { full_name: name },
      },
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    toast.success("Account created");
    navigate("/app/today");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary ff-dot-bg p-4">
      <PageTitle title="Sign up" />
      <div className="w-full max-w-[420px] bg-white rounded-xl shadow-ff-lg p-8 ff-fade-in">
        <div className="flex flex-col items-center mb-6">
          <h1 className="font-display text-3xl text-foreground mb-2">FocusFlow</h1>
          <p className="text-sm text-muted-foreground text-center">Start writing better standups today.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="ff-label">Full name</label>
            <input className="ff-input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ada Lovelace" />
          </div>
          <div>
            <label className="ff-label">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="ff-input" placeholder="you@team.com" />
          </div>
          <div>
            <label className="ff-label">Password</label>
            <div className="relative">
              <input type={show ? "text" : "password"} required value={pw} onChange={(e) => setPw(e.target.value)} className="ff-input pr-11" placeholder="At least 8 characters" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {pw.length > 0 && (
              <div className="mt-2">
                <div className="grid grid-cols-4 gap-1.5">
                  {[0,1,2,3].map((i) => (
                    <div key={i} className={`h-1 rounded-full ${i < s ? sColor : "bg-bg-tertiary"}`} />
                  ))}
                </div>
                <p className="text-[12px] text-muted-foreground mt-1">{sLabel}</p>
              </div>
            )}
          </div>
          <div>
            <label className="ff-label">Confirm password</label>
            <input type={show ? "text" : "password"} required value={pw2} onChange={(e) => setPw2(e.target.value)} className="ff-input" />
          </div>

          {err && <div className="bg-destructive-light text-destructive text-[13px] rounded-md px-3 py-2 border border-[hsl(0_60%_85%)]">{err}</div>}

          <FFButton type="submit" size="lg" loading={busy} className="w-full">Create account</FFButton>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-highlight font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
