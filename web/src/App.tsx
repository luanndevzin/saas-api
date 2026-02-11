import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { ApiProvider } from "./lib/api-provider";
import { ToastProvider } from "./components/toast";
import { Shell } from "./components/shell";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HRPage } from "./pages/HRPage";
import { FinanceAPPage } from "./pages/FinanceAPPage";
import { FinanceARPage } from "./pages/FinanceARPage";
import { MembersPage } from "./pages/MembersPage";
import { PlaygroundPage } from "./pages/PlaygroundPage";
import { RequireAuth } from "./components/require-auth";
import { AuthLayout } from "./components/auth-layout";
import { LandingPage } from "./pages/LandingPage";
import { RequireRoles } from "./components/require-roles";

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
              <Route
                path="/dashboard"
                element={
                  <RequireRoles roles={["owner", "finance"]} fallback="/hr">
                    <DashboardPage />
                  </RequireRoles>
                }
              />
              <Route
                path="/hr"
                element={
                  <RequireRoles roles={["owner", "hr"]} fallback="/dashboard">
                    <HRPage />
                  </RequireRoles>
                }
              />
              <Route
                path="/finance/ap"
                element={
                  <RequireRoles roles={["owner", "finance"]} fallback="/hr">
                    <FinanceAPPage />
                  </RequireRoles>
                }
              />
              <Route
                path="/finance/ar"
                element={
                  <RequireRoles roles={["owner", "finance"]} fallback="/hr">
                    <FinanceARPage />
                  </RequireRoles>
                }
              />
              <Route
                path="/members"
                element={
                  <RequireRoles roles={["owner"]} fallback="/dashboard">
                    <MembersPage />
                  </RequireRoles>
                }
              />
              <Route path="/playground" element={<PlaygroundPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ApiProvider>
  );
}

export default App;
