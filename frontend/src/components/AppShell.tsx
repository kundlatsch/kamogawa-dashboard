import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import NotificationBell from "./NotificationBell";
import Avatar from "./Avatar";

export interface NavItem {
  to: string;
  labelKey: string;
  /** Shown above the label in the student's bottom tab bar on phones. */
  icon?: string;
}

/** Wordmark: the first word in the accent color, the rest in white (e.g. "CHACÃO Boxing Team"). */
export function Wordmark({
  name,
  className = "text-2xl",
  truncate = false,
}: {
  name: string;
  className?: string;
  /** Keep the wordmark on one line, cutting it with an ellipsis when space runs out. */
  truncate?: boolean;
}) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return (
    <span className={`flex items-center gap-2 font-display tracking-wide uppercase ${className}`}>
      <span aria-hidden>🥊</span>
      <span className={truncate ? "min-w-0 truncate" : undefined}>
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
          <Wordmark
            name={user?.gym?.name ?? t("brand.name")}
            // Students on phones get a one-line header: a smaller wordmark that truncates.
            className={isStudent ? "min-w-0 flex-1 text-xl md:flex-none md:text-2xl" : undefined}
            truncate={isStudent}
          />
          {isAccountAdmin && (
            <span className="rounded bg-belt px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-ring uppercase">
              {t("roles.ACCOUNT_ADMIN")}
            </span>
          )}
          <nav className={`flex-1 flex-wrap gap-1 ${isStudent ? "hidden md:flex" : "flex"}`}>
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
          <div className={`flex items-center text-sm ${isStudent ? "gap-1 md:gap-3" : "gap-3"}`}>
            {(isStudent || user?.role === "COACH") && <NotificationBell />}
            {user?.role === "COACH" && (
              <NavLink
                to="/settings"
                title={t("nav.settings")}
                aria-label={t("nav.settings")}
                className={({ isActive }) =>
                  `rounded-md px-2 py-1 text-lg ${isActive ? "bg-glove text-chalk" : "text-smoke hover:text-chalk"}`
                }
              >
                ⚙️
              </NavLink>
            )}
            <NavLink
              to="/profile"
              title={t("profile.title")}
              aria-label={t("profile.title")}
              className={({ isActive }) =>
                `rounded-md px-2 py-1 ${isActive ? "bg-rope text-chalk" : "text-smoke hover:text-chalk"} ${
                  isStudent ? "text-xl md:text-sm" : ""
                }`
              }
            >
              {user && <Avatar person={user} />}{" "}
              <span className={isStudent ? "hidden md:inline" : undefined}>{user?.display_name}</span>
            </NavLink>
            {/* On phones the student logs out from the profile page; the header has no room. */}
            <button onClick={logout} className={`text-smoke hover:text-glove ${isStudent ? "hidden md:inline" : ""}`}>
              {t("auth.logout")}
            </button>
          </div>
        </div>
      </header>
      {/* Students on phones: room for the bottom tab bar (plus the iPhone home indicator). */}
      <main
        className={`mx-auto max-w-7xl px-4 py-6 ${
          isStudent ? "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6" : ""
        }`}
      >
        <Outlet />
      </main>
      {isStudent && <BottomTabBar nav={nav} />}
    </div>
  );
}

/** Phone navigation for students: a fixed tab bar within thumb reach. Hidden from md up. */
function BottomTabBar({ nav }: { nav: NavItem[] }) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rope bg-ring/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="flex">
        {nav.map((item) => (
          <li key={item.to} className="min-w-0 flex-1">
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium ${
                  isActive ? "text-glove" : "text-smoke"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden
                    className={`flex h-7 w-11 items-center justify-center rounded-full text-lg ${isActive ? "bg-glove/20" : ""}`}
                  >
                    {item.icon}
                  </span>
                  <span className="max-w-full truncate">{t(item.labelKey)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
