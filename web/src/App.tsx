import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { ApiProvider, useApi } from "./lib/api-provider";
import { ToastProvider } from "./components/toast";
import { Shell } from "./components/shell";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HRPage } from "./pages/HRPage";
import { FinanceAPPage } from "./pages/FinanceAPPage";
import { FinanceARPage } from "./pages/FinanceARPage";
import { MembersPage } from "./pages/MembersPage";
import { RequireAuth } from "./components/require-auth";
import { AuthLayout } from "./components/auth-layout";
import { LandingPage } from "./pages/LandingPage";
import { RequireRoles } from "./components/require-roles";
import { TimeClockPage } from "./pages/TimeClockPage";

function RoleHomeRedirect() {
  const { me } = useApi();
  const role = me?.role;

  switch (role) {
    case "owner":
      return <Navigate to="/dashboard" replace />;
    case "finance":
      return <Navigate to="/finance/ap" replace />;
    case "hr":
      return <Navigate to="/hr" replace />;
    case "colaborador":
    case "member":
      return <Navigate to="/ponto" replace />;
    default:
      return <Navigate to="/dashboard" replace />;
  }
}

function App() {
  return (
    <ApiProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/login"
              element={
                <AuthLayout>
                  <LoginPage />
                </AuthLayout>
              }
            />
            <Route
              path="/register"
              element={
                <AuthLayout>
                  <RegisterPage />
                </AuthLayout>
              }
            />

            <Route
              element={
                <RequireAuth>
                  <Shell>
                    <Outlet />
                  </Shell>
                </RequireAuth>
              }
            >
              <Route path="/app" element={<RoleHomeRedirect />} />
              <Route
                path="/dashboard"
                element={
                  <RequireRoles roles={["owner", "finance"]} fallback="/app">
                    <DashboardPage />
                  </RequireRoles>
                }
              />
              <Route
                path="/ponto"
                element={
                  <RequireRoles roles={["colaborador", "member"]} fallback="/app">
                    <TimeClockPage />
                  </RequireRoles>
                }
              />
              <Route
                path="/hr"
                element={
                  <RequireRoles roles={["owner", "hr"]} fallback="/app">
                    <HRPage />
                  </RequireRoles>
                }
              />
              <Route
                path="/finance/ap"
                element={
                  <RequireRoles roles={["owner", "finance"]} fallback="/app">
                    <FinanceAPPage />
                  </RequireRoles>
                }
              />
              <Route
                path="/finance/ar"
                element={
                  <RequireRoles roles={["owner", "finance"]} fallback="/app">
                    <FinanceARPage />
                  </RequireRoles>
                }
              />
              <Route
                path="/members"
                element={
                  <RequireRoles roles={["owner"]} fallback="/app">
                    <MembersPage />
                  </RequireRoles>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ApiProvider>
  );
}

export default App;
