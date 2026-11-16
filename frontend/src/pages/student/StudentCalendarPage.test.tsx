import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { api } from "../../api/client";
import type { CalendarEntry } from "../../api/types";
import { addDays, toISODate } from "../../lib/dates";
import StudentCalendarPage from "./StudentCalendarPage";

const tomorrow = toISODate(addDays(new Date(), 1));
const inTwoDays = toISODate(addDays(new Date(), 2));
const entries: CalendarEntry[] = [
  {
    id: 7,
    date: tomorrow,
    start_time: "19:00:00",
    published: true,
    kind: "REGULAR",
    title: "",
    checkin: { deadline: new Date(Date.now() + 86_400_000).toISOString(), open: true, mine: null },
  },
  { id: null, date: inTwoDays, start_time: "14:00:00", published: false },
];

describe("StudentCalendarPage", () => {
  it("links published classes and shows planned ones without details", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: entries });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <StudentCalendarPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const published = await screen.findByRole("link", { name: "19:00" });
    expect(published).toHaveAttribute("href", "/class/7");
    const planned = screen.getByText("14:00");
    expect(planned.closest("a")).toBeNull();
    expect(screen.getByRole("button", { name: /Confirmar presença/ })).toBeInTheDocument();
  });
});
