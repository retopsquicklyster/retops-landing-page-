import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3, LineChart, Upload, MessageSquare, GraduationCap, AlertTriangle,
  Zap, Globe, Package, TrendingDown, Target, Settings, LogOut, Download, Bot, History, Mail,
} from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "../contexts/AuthContext";

const NAV = [
  { to: "/dashboard", label: "QA Dashboard", icon: BarChart3, tid: "nav-qa-dashboard" },
  { to: "/dashboard/executive", label: "Executive View", icon: LineChart, tid: "nav-executive" },
  { to: "/dashboard/upload", label: "Upload Interaction", icon: Upload, tid: "nav-upload" },
  { to: "/dashboard/interactions", label: "All Interactions", icon: MessageSquare, tid: "nav-interactions" },
  { to: "/dashboard/ai-scoring", label: "AI Agent Scoring", icon: Bot, tid: "nav-ai-scoring" },
  { to: "/dashboard/coaching", label: "Coaching Hub", icon: GraduationCap, tid: "nav-coaching" },
  { to: "/dashboard/risk", label: "Risk Monitor", icon: AlertTriangle, tid: "nav-risk" },
  { to: "/dashboard/automation", label: "Coaching Automation", icon: Zap, tid: "nav-automation", soon: true },
  { to: "/dashboard/multilingual", label: "Multilingual", icon: Globe, tid: "nav-multilingual", soon: true },
  { to: "/dashboard/packs", label: "Vertical Packs", icon: Package, tid: "nav-packs", soon: true },
  { to: "/dashboard/churn", label: "Churn Risk & VoC", icon: TrendingDown, tid: "nav-churn" },
  { to: "/dashboard/playbook", label: "Churn Save Playbook", icon: Target, tid: "nav-playbook" },
  { to: "/dashboard/history", label: "Activity History", icon: History, tid: "nav-history" },
  { to: "/dashboard/digest", label: "Weekly Digest", icon: Mail, tid: "nav-digest" },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, tid: "nav-settings" },
];

export default function DashboardLayout({ children, title, subtitle, actions }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen grid grid-cols-[260px,1fr] bg-[hsl(var(--retops-bg))]">
      <aside className="bg-white border-r border-[hsl(var(--retops-border))] py-6 px-5 sticky top-0 h-screen overflow-y-auto" data-testid="sidebar">
        <button data-testid="sidebar-logo-btn" onClick={() => navigate("/")} className="mb-8 block">
          <Logo />
        </button>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/dashboard"}
              data-testid={n.tid}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <n.icon className="w-[18px] h-[18px]" />
              <span>{n.label}</span>
              {n.soon && <span className="ml-auto text-[9px] uppercase tracking-wider pill pill-gold" style={{ padding: "1px 6px" }}>Soon</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-col min-h-screen">
        <header className="bg-white border-b border-[hsl(var(--retops-border))] px-10 py-5 flex items-center justify-between" data-testid="topbar">
          <div>
            <h1 className="font-instrument text-[32px] leading-tight text-[hsl(var(--retops-navy))]" data-testid="page-title">{title}</h1>
            {subtitle && <p className="text-sm text-[hsl(var(--retops-muted))] mt-1">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <div className="flex items-center gap-3 pl-4 border-l border-[hsl(var(--retops-border))]">
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold text-[hsl(var(--retops-text))]" data-testid="user-name">{user?.name}</p>
                <p className="text-xs text-[hsl(var(--retops-muted-2))]">{user?.email}</p>
              </div>
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-9 h-9 rounded-full border border-[hsl(var(--retops-border))]" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[hsl(var(--retops-navy))] text-white grid place-items-center text-sm font-semibold">
                  {(user?.name || "U").slice(0, 1).toUpperCase()}
                </div>
              )}
              <button data-testid="logout-btn" onClick={logout} className="btn-ghost !p-2" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="p-10 flex-1">{children}</main>
      </div>
    </div>
  );
}

export const GenerateReportButton = () => (
  <button data-testid="generate-report-btn" className="btn-gold flex items-center gap-2" onClick={() => window.print()}>
    <Download className="w-4 h-4" /> Generate Report
  </button>
);
