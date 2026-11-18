import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { api } from "../api/client";
import type { StudentPoint } from "../api/types";
import { EditableStudentPoints } from "./StudentPoints";

const points: StudentPoint[] = [{ id: 5, student: 3, kind: "WEAKNESS", text: "Guarda baixa", created_at: "" }];

describe("EditableStudentPoints", () => {
  it("lets the coach add, edit and remove items", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: points });
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: {} });
    const remove = vi.spyOn(api, "delete").mockResolvedValue({ data: {} });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <EditableStudentPoints studentId={3} />
      </QueryClientProvider>,
    );

    const existing = await screen.findByDisplayValue("Guarda baixa");
    fireEvent.change(existing, { target: { value: "Guarda baixa no direto" } });
    fireEvent.blur(existing);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/student-points/5/", { text: "Guarda baixa no direto" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Pontos fortes: Novo item…" }), { target: { value: "Jab rápido" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[0]);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/student-points/", { student: 3, kind: "STRENGTH", text: "Jab rápido" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Remover Guarda baixa" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("/student-points/5/"));
  });
});
