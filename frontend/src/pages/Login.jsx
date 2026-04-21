import { Logo } from "../components/Logo";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const startLogin = () => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr,1fr]">
      <div className="bg-[hsl(var(--retops-navy))] grid-dot p-10 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute -left-[10%] top-[10%] w-[50%] h-[50%] rounded-full bg-[rgba(20,184,166,0.2)] blur-3xl" />
        <div className="absolute -right-[10%] bottom-[10%] w-[50%] h-[50%] rounded-full bg-[rgba(248,210,16,0.15)] blur-3xl" />
        <div className="relative z-10"><Logo dark /></div>
        <div className="max-w-md relative z-10">
          <h1 className="font-instrument text-white text-4xl leading-tight">
            The conversations you never review are where churn hides.
          </h1>
          <p className="text-white/70 mt-4">
            Sign in to see QA coverage, churn risk, and coaching priorities for your support operation.
          </p>
        </div>
        <span className="text-xs text-white/50 relative z-10">© {new Date().getFullYear()} RetOps</span>
      </div>

      <div className="grid place-items-center p-10 bg-white">
        <div className="w-full max-w-sm">
          <h2 className="font-instrument text-3xl text-[hsl(var(--retops-navy))]">Welcome back</h2>
          <p className="text-[hsl(var(--retops-muted))] mt-2 text-sm">
            Use your Google account to access your RetOps workspace.
          </p>

          <button
            data-testid="google-login-btn"
            onClick={startLogin}
            className="mt-8 w-full inline-flex items-center justify-center gap-3 py-3 rounded-xl bg-[hsl(var(--retops-gold))] text-[hsl(var(--retops-navy))] font-semibold hover:bg-[hsl(var(--retops-gold-hover))] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path fill="#0b1f3b" d="M21.35 11.1H12v2.85h5.35c-.23 1.5-1.64 4.4-5.35 4.4-3.22 0-5.85-2.67-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.77 1.45l2.57-2.47C16.57 3.97 14.57 3 12 3 6.98 3 3 7.03 3 12s3.98 9 9 9c5.2 0 8.63-3.66 8.63-8.8 0-.6-.07-1.05-.18-1.5z"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-xs text-[hsl(var(--retops-muted-2))]">
            By signing in you agree to the RetOps demo terms. Sessions are stored as httpOnly cookies for 7 days.
          </p>
        </div>
      </div>
    </div>
  );
}
