import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import QADashboard from "@/pages/QADashboard";
import ExecutiveView from "@/pages/ExecutiveView";
import UploadInteraction from "@/pages/UploadInteraction";
import AllInteractions from "@/pages/AllInteractions";
import InteractionDetail from "@/pages/InteractionDetail";
import CoachingHub from "@/pages/CoachingHub";
import RiskMonitor from "@/pages/RiskMonitor";
import ChurnRiskVoC from "@/pages/ChurnRiskVoC";
import ChurnSavePlaybook from "@/pages/ChurnSavePlaybook";
import Settings from "@/pages/Settings";
import ComingSoon from "@/pages/ComingSoon";
import AIAgentScoring from "@/pages/AIAgentScoring";
import SharedPlaybook from "@/pages/SharedPlaybook";
import ActivityHistory from "@/pages/ActivityHistory";
import WeeklyDigest from "@/pages/WeeklyDigest";
import BulkUpload from "@/pages/BulkUpload";

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/share/p/:token" element={<SharedPlaybook />} />
      <Route path="/dashboard" element={<ProtectedRoute><QADashboard /></ProtectedRoute>} />
      <Route path="/dashboard/executive" element={<ProtectedRoute><ExecutiveView /></ProtectedRoute>} />
      <Route path="/dashboard/upload" element={<ProtectedRoute><UploadInteraction /></ProtectedRoute>} />
      <Route path="/dashboard/bulk" element={<ProtectedRoute><BulkUpload /></ProtectedRoute>} />
      <Route path="/dashboard/interactions" element={<ProtectedRoute><AllInteractions /></ProtectedRoute>} />
      <Route path="/dashboard/interactions/:id" element={<ProtectedRoute><InteractionDetail /></ProtectedRoute>} />
      <Route path="/dashboard/ai-scoring" element={<ProtectedRoute><AIAgentScoring /></ProtectedRoute>} />
      <Route path="/dashboard/coaching" element={<ProtectedRoute><CoachingHub /></ProtectedRoute>} />
      <Route path="/dashboard/risk" element={<ProtectedRoute><RiskMonitor /></ProtectedRoute>} />
      <Route path="/dashboard/churn" element={<ProtectedRoute><ChurnRiskVoC /></ProtectedRoute>} />
      <Route path="/dashboard/playbook" element={<ProtectedRoute><ChurnSavePlaybook /></ProtectedRoute>} />
      <Route path="/dashboard/history" element={<ProtectedRoute><ActivityHistory /></ProtectedRoute>} />
      <Route path="/dashboard/digest" element={<ProtectedRoute><WeeklyDigest /></ProtectedRoute>} />
      <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/dashboard/automation" element={<ProtectedRoute><ComingSoon title="Coaching Automation" blurb="Automated coaching assignments & scheduled follow-ups based on scored interactions." /></ProtectedRoute>} />
      <Route path="/dashboard/multilingual" element={<ProtectedRoute><ComingSoon title="Multilingual" blurb="Score and analyze interactions across 12+ languages with native-quality rubrics." /></ProtectedRoute>} />
      <Route path="/dashboard/packs" element={<ProtectedRoute><ComingSoon title="Vertical Packs" blurb="Pre-configured QA rubrics for Fintech, Healthcare, Telco, Logistics, and SaaS." /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
