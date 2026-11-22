import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { User } from "../api/types";
import AppShell, { type NavItem } from "./AppShell";

const student: User = {
  id: 1,
  username: "ana",
  display_name: "Ana",
  avatar_emoji: "🥊",
  avatar_url: null,
  fighter_class: null,
  secondary_fighter_class: null,
  level: "",
  color: "#d62828",
  handedness: "UNSPECIFIED",
  limitations: "",
  weekly_classes: null,
  role: "STUDENT",
  gym: { id: 1, name: "Chacão Boxing Team", slug: "chacao-boxing-team", color: "#d62828", assessment_scale_min: 1, assessment_scale_max: 10 },
  is_active: true,
};

let user: User = student;
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user, logout: vi.fn() }) }));
vi.mock("./NotificationBell", () => ({ default: () => null }));

const nav: NavItem[] = [
  { to: "/", labelKey: "nav.today", icon: "🥊" },
  { to: "/ranking", labelKey: "nav.ranking", icon: "🏆" },
];

function renderShell() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/ranking"]}>
        <AppShell nav={nav} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  it("gives students a bottom tab bar with every section", () => {
    user = student;
    renderShell();
    const tabBar = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(within(tabBar).getByRole("link", { name: /Hoje/ })).toHaveAttribute("href", "/");
    expect(within(tabBar).getByRole("link", { name: /Ranking/ })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the coach header without the student tab bar", () => {
    user = { ...student, role: "COACH" };
    renderShell();
    expect(screen.queryByRole("navigation", { name: "Navegação principal" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });
});
