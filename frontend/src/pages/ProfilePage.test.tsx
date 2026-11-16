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
  avatar_url: null,
  fighter_class: null,
  color: "#d62828",
  handedness: "UNSPECIFIED",
  limitations: "",
  role: "STUDENT",
  gym: { id: 1, name: "Chacão Boxing Team", slug: "chacao-boxing-team", color: "#d62828", assessment_scale_min: 1, assessment_scale_max: 10 },
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
  it("saves the display name, emoji, color, handedness and limitations but never the login", async () => {
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: {} });
    renderPage();

    fireEvent.change(screen.getByLabelText("Nome exibido"), { target: { value: "Ana Pugilista" } });
    fireEvent.click(screen.getByRole("button", { name: "🐯" }));
    fireEvent.click(screen.getByRole("button", { name: "#3a86ff" }));
    fireEvent.click(screen.getByRole("button", { name: "Canhoto" }));
    fireEvent.change(screen.getByLabelText("Limitações"), { target: { value: " Sem sparring " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/auth/me/", {
        display_name: "Ana Pugilista",
        avatar_emoji: "🐯",
        color: "#3a86ff",
        handedness: "LEFT",
        limitations: "Sem sparring",
      }),
    );
    expect(refreshUser).toHaveBeenCalled();
    expect(screen.getByText(/@ana/)).toBeInTheDocument();
  });
});

describe("ProfilePage photo", () => {
  it("uploads the chosen photo as multipart form data", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    renderPage();
    const file = new File(["img"], "me.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Enviar foto"), { target: { files: [file] } });
    await waitFor(() => expect(post).toHaveBeenCalledWith("/auth/me/avatar/", expect.any(FormData)));
    expect((post.mock.calls[0][1] as FormData).get("avatar")).toBe(file);
  });
});
