import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ptBR from "./locales/pt-BR.json";

// To add a language: create `locales/<code>.json` with the same keys and register it here.
export const resources = {
  "pt-BR": { translation: ptBR },
} as const;

export const defaultLanguage = "pt-BR";

void i18n.use(initReactI18next).init({
  resources,
  lng: defaultLanguage,
  fallbackLng: defaultLanguage,
  interpolation: { escapeValue: false },
});

export default i18n;
