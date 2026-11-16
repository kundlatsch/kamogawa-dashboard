import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { api } from "../../api/client";
import type { MyProgress } from "../../api/types";
import ProgressPage from "./ProgressPage";

const progress: MyProgress = {
  fighter_class: {
    id: 1,
    name: "Contragolpeador",
    description: "Counterpuncher",
    emoji: "🔄",
    color: "#2a9d8f",
    art_key: "counterpuncher",
    image_url: null,
    order: 4,
    archived: false,
  },
  missions: [
    {
      id: 9,
      title: "100 polichinelos",
      description: "",
      emoji: "🎯",
      xp_reward: 25,
      active: true,
      starts_on: null,
      ends_on: null,
      repeatable: false,
      created_at: "",
      status: null,
      times_completed: 0,
      can_complete: true,
    },
  ],
};

describe("ProgressPage", () => {
  it("shows the class and lets the student complete a mission", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: progress });
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProgressPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Contragolpeador" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Contragolpeador" })).toBeInTheDocument();
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Concluí!" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/me/missions/9/complete/"));
  });
});
