import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import { useAuth } from "./lib/auth";
import Admin from "./pages/Admin";
import Ask from "./pages/Ask";
import Dashboard from "./pages/Dashboard";
import DocumentDetail from "./pages/DocumentDetail";
import Documents from "./pages/Documents";
import Landing from "./pages/Landing";
import { ForgotPassword, Login, Register, VerifyEmail } from "./pages/AuthPages";
import Plans from "./pages/Plans";
import Quizzes from "./pages/Quizzes";

function Protected({ children, admin }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid h-screen place-items-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/app" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/app" element={<Protected><Dashboard /></Protected>} />
      <Route path="/app/documents" element={<Protected><Documents /></Protected>} />
      <Route path="/app/documents/:id" element={<Protected><DocumentDetail /></Protected>} />
      <Route path="/app/ask" element={<Protected><Ask /></Protected>} />
      <Route path="/app/quizzes" element={<Protected><Quizzes /></Protected>} />
      <Route path="/app/plans" element={<Protected><Plans /></Protected>} />
      <Route path="/app/admin" element={<Protected admin><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
