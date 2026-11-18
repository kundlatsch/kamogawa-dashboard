import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { api } from "../../api/client";
import type { FighterClass, LeaderboardEntry } from "../../api/types";
import StudentRankingPage from "./StudentRankingPage";

vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 2 } }) }));

const counterpuncher: FighterClass = {
  id: 7,
  name: "Counterpuncher",
  description: "Espera e contra-ataca",
  emoji: "🔄",
  color: "#2a9d8f",
  art_key: "",
  image_url: null,
  order: 4,
  archived: false,
};
const row = (id: number, name: string, attended: number, fighterClass: number | null) =>
  ({ student: { id, display_name: name }, fighter_class: fighterClass, attended, absences: 0 }) as LeaderboardEntry;

describe("StudentRankingPage", () => {
  it("ranks by attendance and shows the student's own class, with no missions", async () => {
    vi.spyOn(api, "get").mockImplementation(async (url: string) =>
      url === "/ranking/"
        ? { data: [row(1, "Ana", 1, null), row(2, "Bia", 4, 7)] }
        : { data: [counterpuncher] },
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StudentRankingPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Counterpuncher" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Bia (você)");
    expect(items[1]).toHaveTextContent("Ana");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText(/miss/i)).not.toBeInTheDocument();
  });
});
