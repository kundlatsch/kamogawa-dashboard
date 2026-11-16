import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { api } from "../api/client";
import type { CheckInState } from "../api/types";
import CheckInButton from "./CheckInButton";

const inTwoHours = new Date(Date.now() + 2 * 3600_000).toISOString();

function renderButton(state: CheckInState) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CheckInButton sessionId={7} state={state} />
    </QueryClientProvider>,
  );
}

describe("CheckInButton", () => {
  it("sends a pain report when checking in", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: {} });
    renderButton({ deadline: inTwoHours, open: true, mine: null });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar presença/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Estou com dor/ }));
    fireEvent.change(screen.getByLabelText("Onde?"), { target: { value: " Ombro " } });
    fireEvent.change(screen.getByRole("slider"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/me/checkins/7/", {
        has_pain: true,
        pain_location: "Ombro",
        pain_level: 6,
        notes: "",
      }),
    );
  });

  it("shows the confirmation and no actions once check-in is closed", () => {
    renderButton({
      deadline: inTwoHours,
      open: false,
      mine: { id: 1, has_pain: false, pain_location: "", pain_level: null, notes: "", created_at: "" },
    });
    expect(screen.getByText(/Presença confirmada/)).toBeInTheDocument();
    expect(screen.getByText(/Check-in encerrado/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
