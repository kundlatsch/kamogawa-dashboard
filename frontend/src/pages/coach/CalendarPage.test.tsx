import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { api } from "../../api/client";
import type { TrainingSession } from "../../api/types";
import { addDays, toISODate } from "../../lib/dates";
import CalendarPage from "./CalendarPage";

const tomorrow = toISODate(addDays(new Date(), 1));
const inTwoDays = toISODate(addDays(new Date(), 2));
const session: TrainingSession = {
  id: 3,
  date: tomorrow,
  start_time: "19:00:00",
  title: "",
  notes: "",
  kind: "REGULAR",
  status: "PUBLISHED",
  published_at: null,
  objective_override: "",
  objective: "",
};

function renderPage() {
  vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url === "/sessions/") return { data: [session] };
    if (url === "/schedule/") return { data: { training_weekdays: [0], default_start_time: "18:30:00" } };
    throw new Error(url);
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00`));

describe("CalendarPage", () => {
  it("turns a class day into sparring without touching its exercises", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: dayLabel(tomorrow) }));
    fireEvent.click(await screen.findByRole("button", { name: /Transformar em sparring/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/sessions/3/convert/", { kind: "SPARRING" }));
  });

  it("creates an extra class on a free day with the date already filled", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: { ...session, id: 4 } });
    renderPage();
    await screen.findByRole("button", { name: dayLabel(tomorrow) });
    fireEvent.click(screen.getByRole("button", { name: dayLabel(inTwoDays) }));
    expect(screen.queryByLabelText("Data")).not.toBeInTheDocument();
    await screen.findByDisplayValue("18:30"); // the gym's usual class time
    fireEvent.click(await screen.findByRole("button", { name: "Criar" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/sessions/", expect.objectContaining({ date: inTwoDays, start_time: "18:30", kind: "EXTRA" })),
    );
  });
});
