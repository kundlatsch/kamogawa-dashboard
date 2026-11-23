import { useTranslation } from "react-i18next";

import { LANGUAGES, chooseLanguage, type Language } from "../i18n";

const SHORT: Record<Language, string> = { en: "EN", "pt-BR": "PT" };

/** EN | PT switch for public pages (landing, login); the choice is remembered on this device. */
export default function LanguageToggle() {
  const { t, i18n } = useTranslation();
  return (
    <div role="group" aria-label={t("language.switch")} className="flex rounded-md border border-rope p-0.5 text-xs font-semibold">
      {LANGUAGES.map((language) => {
        const active = i18n.language === language;
        return (
          <button
            key={language}
            type="button"
            lang={language}
            aria-pressed={active}
            title={t(`language.names.${language}`)}
            onClick={() => chooseLanguage(language)}
            className={`rounded px-2 py-1 ${active ? "bg-glove text-chalk" : "text-smoke hover:text-chalk"}`}
          >
            {SHORT[language]}
          </button>
        );
      })}
    </div>
  );
}
