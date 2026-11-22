import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { api } from "../../api/client";
import type { FighterClass, StudentPoint } from "../../api/types";
import StatsPage from "./StatsPage";

vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 3, level: "", fighter_class: null, gym: null } }) }));

const swarmer: FighterClass = {
  id: 7,
  name: "Swarmer",
  description: "",
  emoji: "🔥",
  color: "#d62828",
  art_key: "",
  image_url: null,
  order: 1,
  archived: false,
};
const counter: FighterClass = { ...swarmer, id: 8, name: "Counterpuncher", emoji: "🎯" };
const points: StudentPoint[] = [
  { id: 1, student: 3, kind: "STRENGTH", text: "Jab rápido", created_at: "" },
  { id: 2, student: 3, kind: "WEAKNESS", text: "Tarefa: 3 rounds de sombra", created_at: "" },
];
const responses: Record<string, unknown> = {
  "/auth/me/": { id: 3, level: "INTERMEDIATE_ADVANCED", fighter_class: 7, secondary_fighter_class: 8 },
  "/me/points/": points,
  "/fighter-classes/": [swarmer, counter],
  "/me/assessments/": [],
  "/me/week/": { notes: [] },
  "/metrics/": [],
};

describe("StatsPage", () => {
  it("shows the student's level, main and secondary fighter styles and the coach's strengths and weaknesses", async () => {
    vi.spyOn(api, "get").mockImplementation(async (url: string) => ({ data: responses[url] ?? [] }));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StatsPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Swarmer" })).toBeInTheDocument();
    expect(screen.getByText("Intermediário/Avançado")).toBeInTheDocument();
    expect(screen.getByText("Counterpuncher")).toBeInTheDocument();
    expect(await screen.findByText("Jab rápido")).toBeInTheDocument();
    expect(screen.getByText("Tarefa: 3 rounds de sombra")).toBeInTheDocument();
  });
});
