import { render, screen } from "@testing-library/react";

import App from "./App";

describe("App", () => {
  it("shows the login screen when signed out", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Usuário")).toBeInTheDocument();
  });
});
