import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";
import i18n, { browserLanguage, chooseLanguage, followAutomaticLanguage, loadInstallDefault, matchLanguage } from ".";
import LanguageToggle from "../components/LanguageToggle";

function keys(tree: object, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "object" ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

function setBrowserLanguages(languages: string[]) {
  Object.defineProperty(navigator, "languages", { value: languages, configurable: true });
}

afterEach(() => setBrowserLanguages(["en-US", "en"]));

describe("languages", () => {
  it("has every Portuguese string in English too", () => {
    expect(keys(en).sort()).toEqual(keys(ptBR).sort());
  });

  it("maps browser language tags to the supported languages", () => {
    expect(matchLanguage("pt")).toBe("pt-BR");
    expect(matchLanguage("pt-PT")).toBe("pt-BR");
    expect(matchLanguage("en-GB")).toBe("en");
    expect(matchLanguage("fr-FR")).toBeNull();
    setBrowserLanguages(["fr-FR", "pt-BR"]);
    expect(browserLanguage()).toBe("pt-BR");
    setBrowserLanguages(["de-DE"]);
    expect(browserLanguage()).toBeNull();
  });

  it("follows the browser, then the install default, unless the user chose a language", async () => {
    setBrowserLanguages(["de-DE"]);
    await loadInstallDefault(async () => ({ default_language: "pt-BR" }));
    expect(i18n.language).toBe("pt-BR");
    chooseLanguage("en");
    expect(i18n.language).toBe("en");
    expect(localStorage.getItem("cbt.language")).toBe("en");
    followAutomaticLanguage();
    expect(i18n.language).toBe("pt-BR");
    setBrowserLanguages(["en-US"]);
    followAutomaticLanguage();
    expect(i18n.language).toBe("en");
    await loadInstallDefault(async () => ({ default_language: "en" }));
  });

  it("switches between English and Portuguese with the EN | PT toggle", () => {
    render(
      <MemoryRouter>
        <LanguageToggle />
      </MemoryRouter>,
    );
    act(() => fireEvent.click(screen.getByRole("button", { name: "EN" })));
    expect(i18n.language).toBe("en");
    expect(screen.getByRole("group", { name: "Change language" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
    act(() => fireEvent.click(screen.getByRole("button", { name: "PT" })));
    expect(screen.getByRole("group", { name: "Mudar idioma" })).toBeInTheDocument();
  });
});
