import { render, screen } from "@testing-library/react";

import App from "./App";

describe("App", () => {
  it("renders the brand name in Portuguese locale", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<App />);
    expect(screen.getByRole("heading", { name: "Chacão Boxing Team" })).toBeInTheDocument();
    expect(await screen.findByText("Servidor conectado")).toBeInTheDocument();
  });
});
