import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { api } from "../api/client";
import type { User } from "../api/types";
import ProfilePage from "./ProfilePage";

const user: User = {
  id: 1,
  username: "ana",
  display_name: "Ana",
  avatar_emoji: "🥊",
  color: "#d62828",
  role: "STUDENT",
  gym: { id: 1, name: "Chacão Boxing Team", slug: "chacao-boxing-team", color: "#d62828" },
  is_active: true,
};

const refreshUser = vi.fn().mockResolvedValue(undefined);
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user, refreshUser }) }));

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfilePage />
    </QueryClientProvider>,
  );
}

describe("ProfilePage", () => {
  it("saves the display name, emoji and color but never the login", async () => {
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: {} });
    renderPage();

    fireEvent.change(screen.getByLabelText("Nome exibido"), { target: { value: "Ana Pugilista" } });
    fireEvent.click(screen.getByRole("button", { name: "🐯" }));
    fireEvent.click(screen.getByRole("button", { name: "#3a86ff" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/auth/me/", {
        display_name: "Ana Pugilista",
        avatar_emoji: "🐯",
        color: "#3a86ff",
      }),
    );
    expect(refreshUser).toHaveBeenCalled();
    expect(screen.getByText(/@ana/)).toBeInTheDocument();
  });
});
