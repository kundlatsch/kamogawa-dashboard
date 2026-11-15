import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import NotificationBell from "./NotificationBell";

export interface NavItem {
  to: string;
  labelKey: string;
}

export function Brand() {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
      <span aria-hidden>🥊</span>
      <span>
        <span className="text-glove">Chacão</span> {t("brand.suffix")}
      </span>
    </span>
  );
}

export default function AppShell({ nav }: { nav: NavItem[] }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-rope bg-ring/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Brand />
          <nav className="flex flex-1 flex-wrap gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium ${
                    isActive ? "bg-glove text-chalk" : "text-smoke hover:text-chalk"
                  }`
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            {user?.role === "STUDENT" && <NotificationBell />}
            <span className="text-smoke">
              {user?.avatar_emoji} {user?.display_name}
            </span>
            <button onClick={logout} className="text-smoke hover:text-glove">
              {t("auth.logout")}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
