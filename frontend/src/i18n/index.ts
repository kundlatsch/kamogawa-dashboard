import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";

// To add a language: create `locales/<code>.json` with the same keys, register it here and in
// `LANGUAGES`, add `src/changelog/<code>.json`, and list it in the backend's UI_LANGUAGES setting.
export const resources = {
  en: { translation: en },
  "pt-BR": { translation: ptBR },
} as const;

export type Language = keyof typeof resources;
export const LANGUAGES = Object.keys(resources) as Language[];
/** Used when nothing else picks a language (no saved choice, unsupported browser, no server default). */
export const FALLBACK_LANGUAGE: Language = "en";

const STORAGE_KEY = "cbt.language";

/** The supported language for a BCP 47 tag ("pt", "pt-PT", "en-US"…), if any. */
export function matchLanguage(tag: string | null | undefined): Language | null {
  const base = (tag ?? "").toLowerCase().split("-")[0];
  if (base === "pt") return "pt-BR";
  if (base === "en") return "en";
  return null;
}

/** The first of the browser's preferred languages that the app supports. */
export function browserLanguage(): Language | null {
  const tags = typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    const match = matchLanguage(tag);
    if (match) return match;
  }
  return null;
}

function storedLanguage(): Language | null {
  try {
    return matchLanguage(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** The install's DEFAULT_LANGUAGE, once loaded from the server. */
let installDefault: Language = FALLBACK_LANGUAGE;

/** What to show when the user has not picked a language: the browser's, else the install default. */
export function automaticLanguage(): Language {
  return browserLanguage() ?? installDefault;
}

/** Switch the UI language and remember it on this device. */
export function chooseLanguage(language: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* storage unavailable: the choice lasts until reload */
  }
  void i18n.changeLanguage(language);
}

/** Forget the choice on this device and go back to the automatic language. */
export function followAutomaticLanguage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing stored */
  }
  void i18n.changeLanguage(automaticLanguage());
}

/** Load the server's DEFAULT_LANGUAGE; it only matters when the browser's language is unsupported. */
export async function loadInstallDefault(fetchConfig: () => Promise<{ default_language?: string }>) {
  try {
    const match = matchLanguage((await fetchConfig()).default_language);
    if (!match) return;
    installDefault = match;
    if (!storedLanguage() && !browserLanguage()) void i18n.changeLanguage(match);
  } catch {
    /* keep the fallback */
  }
}

i18n.on("languageChanged", (language) => {
  if (typeof document !== "undefined") document.documentElement.lang = language;
});

void i18n.use(initReactI18next).init({
  resources,
  lng: storedLanguage() ?? automaticLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: { escapeValue: false },
});

export default i18n;
