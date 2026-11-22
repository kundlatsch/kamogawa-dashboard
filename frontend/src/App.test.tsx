import { fireEvent, render, screen } from "@testing-library/react";

import App from "./App";

describe("App", () => {
  it("shows the login screen when signed out", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Usuário")).toBeInTheDocument();
  });

  it("shows the app version and author in the login footer", () => {
    render(<App />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent(`Kamogawa Dashboard v${__APP_VERSION__}, desenvolvido por Taguma`);
    expect(screen.getByRole("link", { name: "Taguma" })).toHaveAttribute("href", "https://github.com/kundlatsch");
  });

  it("opens the release notes when the version in the login footer is clicked", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: `v${__APP_VERSION__}` }));
    const dialog = screen.getByRole("dialog", { name: `Novidades da versão ${__APP_VERSION__}` });
    expect(dialog).toHaveTextContent("O ranking agora considera apenas a presença nos treinos.");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("toggles password visibility on the login screen", () => {
    render(<App />);
    const password = screen.getByLabelText("Senha");
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(password).toHaveAttribute("type", "password");
  });
});
