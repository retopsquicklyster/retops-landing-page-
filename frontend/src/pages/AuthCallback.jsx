import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const session_id = params.get("session_id");
    if (!session_id) {
      navigate("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        const r = await api.post("/auth/session", { session_id });
        setUser(r.data);
        // clear the hash + go to dashboard
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { replace: true, state: { user: r.data } });
      } catch (e) {
        console.error("auth exchange failed", e);
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen grid place-items-center bg-[hsl(var(--bg-subtle))]" data-testid="auth-callback">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[hsl(var(--brand))] border-t-transparent animate-spin" />
        <p className="text-sm text-[hsl(var(--ink-2))]">Signing you in…</p>
      </div>
    </div>
  );
}
