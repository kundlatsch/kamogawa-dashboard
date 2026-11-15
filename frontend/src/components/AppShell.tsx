import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import NotificationBell from "./NotificationBell";

export interface NavItem {
  to: string;
  labelKey: string;
}

/** Wordmark: the first word in the accent color, the rest in white (e.g. "CHACÃO Boxing Team"). */
export function Wordmark({ name }: { name: string }) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return (
    <span className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
      <span aria-hidden>🥊</span>
      <span>
        <span className="text-glove">{first}</span> {rest.join(" ")}
      </span>
    </span>
  );
}

export default function AppShell({ nav }: { nav: NavItem[] }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const isAccountAdmin = user?.role === "ACCOUNT_ADMIN";
  const isStudent = user?.role === "STUDENT";

  return (
    <div
      className="min-h-screen"
      data-theme={isStudent ? "student" : "staff"}
      // Students see their gym's color; coaches and admins keep the fixed red theme.
      style={isStudent && user?.gym ? ({ "--color-glove": user.gym.color } as CSSProperties) : undefined}
    >
      <header className="sticky top-0 z-40 border-b border-rope bg-ring/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Wordmark name={user?.gym?.name ?? t("brand.name")} />
          {isAccountAdmin && (
            <span className="rounded bg-belt px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-ring uppercase">
              {t("roles.ACCOUNT_ADMIN")}
            </span>
          )}
          <nav className="flex flex-1 flex-wrap gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/" && !isAccountAdmin}
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
            <NavLink
              to="/profile"
              title={t("profile.title")}
              className={({ isActive }) =>
                `rounded-md px-2 py-1 ${isActive ? "bg-rope text-chalk" : "text-smoke hover:text-chalk"}`
              }
            >
              {user?.avatar_emoji} {user?.display_name}
            </NavLink>
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
