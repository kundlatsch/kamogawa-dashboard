import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { isCoach } from "./api/types";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AppShell, { type NavItem } from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import GymDetailPage from "./pages/admin/GymDetailPage";
import GymsPage from "./pages/admin/GymsPage";
import TodayPage from "./pages/student/TodayPage";
import UpcomingPage from "./pages/student/UpcomingPage";
import AccountsPage from "./pages/coach/AccountsPage";
import CalendarPage from "./pages/coach/CalendarPage";
import BoardPage from "./pages/coach/board/BoardPage";
import DrillsPage from "./pages/coach/DrillsPage";
import SettingsPage from "./pages/coach/SettingsPage";

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

  if (user.role === "ACCOUNT_ADMIN") {
    return (
      <Routes>
        <Route element={<AppShell nav={[{ to: "/", labelKey: "nav.gyms" }]} />}>
          <Route index element={<GymsPage />} />
          <Route path="gyms/:gymId" element={<GymDetailPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  if (isCoach(user)) {
    const nav: NavItem[] = [
      { to: "/", labelKey: "nav.board" },
      { to: "/calendar", labelKey: "nav.calendar" },
      { to: "/drills", labelKey: "nav.drills" },
      { to: "/students", labelKey: "nav.students" },
      { to: "/settings", labelKey: "nav.settings" },
    ];
    return (
      <Routes>
        <Route element={<AppShell nav={nav} />}>
          <Route index element={<BoardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="drills" element={<DrillsPage />} />
          <Route path="students" element={<AccountsPage kind="students" />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
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
        <Route index element={<TodayPage />} />
        <Route path="upcoming" element={<UpcomingPage />} />
        <Route path="profile" element={<ProfilePage />} />
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
