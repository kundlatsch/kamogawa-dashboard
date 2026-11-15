import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { isStaff } from "./api/types";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AppShell, { type NavItem } from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import Placeholder from "./pages/Placeholder";
import AccountsPage from "./pages/coach/AccountsPage";
import DrillsPage from "./pages/coach/DrillsPage";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } });

function AppRoutes() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  if (loading) return <p className="p-6 text-smoke">{t("common.loading")}</p>;
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  if (isStaff(user)) {
    const nav: NavItem[] = [
      { to: "/", labelKey: "nav.board" },
      { to: "/calendar", labelKey: "nav.calendar" },
      { to: "/drills", labelKey: "nav.drills" },
      { to: "/students", labelKey: "nav.students" },
      ...(user.role === "ADMIN" ? [{ to: "/coaches", labelKey: "nav.coaches" }] : []),
      { to: "/settings", labelKey: "nav.settings" },
    ];
    return (
      <Routes>
        <Route element={<AppShell nav={nav} />}>
          <Route index element={<Placeholder titleKey="nav.board" />} />
          <Route path="calendar" element={<Placeholder titleKey="nav.calendar" />} />
          <Route path="drills" element={<DrillsPage />} />
          <Route path="students" element={<AccountsPage kind="students" />} />
          {user.role === "ADMIN" && <Route path="coaches" element={<AccountsPage kind="coaches" />} />}
          <Route path="settings" element={<Placeholder titleKey="nav.settings" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  const nav: NavItem[] = [
    { to: "/", labelKey: "nav.today" },
    { to: "/upcoming", labelKey: "nav.upcoming" },
  ];
  return (
    <Routes>
      <Route element={<AppShell nav={nav} />}>
        <Route index element={<Placeholder titleKey="nav.today" />} />
        <Route path="upcoming" element={<Placeholder titleKey="nav.upcoming" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
