import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { api } from "../api/client";
import type { User } from "../api/types";
import FocusTextField from "./FocusTextField";

const ana = { id: 5, display_name: "Ana", focus_text: "Guarda alta" } as User;

describe("FocusTextField", () => {
  it("saves the coach's free text when the field loses focus", async () => {
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: {} });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FocusTextField student={ana} />
      </QueryClientProvider>,
    );
    const field = screen.getByRole("textbox", { name: "Focos de Ana" });
    expect(field).toHaveValue("Guarda alta");
    fireEvent.blur(field);
    expect(patch).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "Guarda alta\nRespirar " } });
    fireEvent.blur(field);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/students/5/", { focus_text: "Guarda alta\nRespirar" }));
  });
});
