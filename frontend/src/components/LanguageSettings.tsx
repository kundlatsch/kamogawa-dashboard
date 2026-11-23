import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { LANGUAGES, chooseLanguage, followAutomaticLanguage, matchLanguage } from "../i18n";

/** Profile card where any user (admin, coach, student) picks the UI language; saved on their account. */
export default function LanguageSettings() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const save = useMutation({
    mutationFn: async (language: string) => api.patch("/auth/me/", { language }),
    onSuccess: (_response, language) => {
      const match = matchLanguage(language);
      if (match) chooseLanguage(match);
      else followAutomaticLanguage();
      return refreshUser();
    },
  });
  if (!user) return null;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-rope bg-canvas p-5">
      <h2 className="font-display text-2xl tracking-wide uppercase">{t("language.title")}</h2>
      <p className="-mt-2 text-xs text-smoke">{t("language.hint")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label={t("language.title")}
          value={user.language}
          disabled={save.isPending}
          onChange={(event) => save.mutate(event.target.value)}
          className="rounded-md border border-rope bg-ring px-3 py-2 text-sm text-chalk outline-none focus:border-glove"
        >
          <option value="">{t("language.auto")}</option>
          {LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {t(`language.names.${language}`)}
            </option>
          ))}
        </select>
        {save.isSuccess && <span className="text-sm text-belt">{t("language.saved")}</span>}
        {save.isError && <span className="text-sm text-glove">{t("profile.detailsError")}</span>}
      </div>
    </section>
  );
}
