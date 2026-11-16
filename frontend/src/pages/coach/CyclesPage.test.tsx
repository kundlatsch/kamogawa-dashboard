import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { api } from "../../api/client";
import type { Macrocycle, NamedItem } from "../../api/types";
import CyclesPage from "./CyclesPage";

const speed: NamedItem = { id: 1, name: "Velocidade", color: "#3a86ff", order: 0, archived: false };
const strength: NamedItem = { id: 2, name: "Força", color: "#d62828", order: 1, archived: false };
const adaptation: NamedItem = { id: 9, name: "Adaptação", color: "#2a9d8f", order: 0, archived: false };

const macro: Macrocycle = {
  id: 5,
  name: "Semestre 1",
  start_date: "2026-12-07",
  notes: "",
  end_date: "2026-12-20",
  mesocycles: [
    {
      id: 11,
      name: "",
      notes: "",
      order: 0,
      valence: speed,
      start_date: "2026-12-07",
      end_date: "2026-12-13",
      microcycles: [
        {
          id: 21,
          order: 0,
          objective: "Jab rápido",
          length_days: 7,
          phase: adaptation,
          start_date: "2026-12-07",
          end_date: "2026-12-13",
        },
      ],
    },
    {
      id: 12,
      name: "",
      notes: "",
      order: 1,
      valence: strength,
      start_date: "2026-12-14",
      end_date: "2026-12-20",
      microcycles: [],
    },
  ],
};

beforeEach(() => {
  vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url === "/macrocycles/") return { data: [macro] };
    if (url === "/valences/") return { data: [speed, strength] };
    if (url === "/microcycle-phases/") return { data: [adaptation] };
    throw new Error(`unexpected GET ${url}`);
  });
});

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CyclesPage />
    </QueryClientProvider>,
  );
}

describe("CyclesPage", () => {
  it("shows mesocycles in order with their weeks and objectives", async () => {
    renderPage();
    expect(await screen.findByText("Mesociclo 1")).toBeInTheDocument();
    expect(screen.getByText("Mesociclo 2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jab rápido")).toBeInTheDocument();
  });

  it("moves a mesocycle later by reordering the macrocycle", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    renderPage();
    await screen.findByText("Mesociclo 1");
    fireEvent.click(screen.getAllByRole("button", { name: "Mover para depois" })[0]);
    await waitFor(() => expect(post).toHaveBeenCalledWith("/mesocycles/reorder/", { macrocycle: 5, ids: [12, 11] }));
  });

  it("saves a week's objective when the field loses focus", async () => {
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: {} });
    renderPage();
    const field = await screen.findByDisplayValue("Jab rápido");
    fireEvent.change(field, { target: { value: "Esquiva e contra" } });
    fireEvent.blur(field);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/microcycles/21/", { objective: "Esquiva e contra" }));
  });
});
