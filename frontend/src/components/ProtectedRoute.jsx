import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true, state: { from: location } });
  }, [loading, user, location, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[hsl(var(--bg-subtle))]">
        <div className="w-10 h-10 rounded-full border-2 border-[hsl(var(--brand))] border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
