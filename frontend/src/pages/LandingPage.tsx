import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import planningBoardEn from "../assets/landing/en/planning-board.webp";
import studentMyStatsEn from "../assets/landing/en/student-my-stats.webp";
import studentProfileEn from "../assets/landing/en/student-profile.webp";
import studentStatsEn from "../assets/landing/en/student-stats.webp";
import planningBoardPt from "../assets/landing/pt-BR/planning-board.webp";
import studentMyStatsPt from "../assets/landing/pt-BR/student-my-stats.webp";
import studentProfilePt from "../assets/landing/pt-BR/student-profile.webp";
import studentStatsPt from "../assets/landing/pt-BR/student-stats.webp";
import AppFooter from "../components/AppFooter";
import LanguageToggle from "../components/LanguageToggle";

const REPO_URL = "https://github.com/kundlatsch/kamogawa-dashboard";

/** Screenshots of the app in each interface language. */
const SCREENSHOTS = {
  en: { planningBoard: planningBoardEn, studentProfile: studentProfileEn, studentStats: studentStatsEn, studentMyStats: studentMyStatsEn },
  "pt-BR": { planningBoard: planningBoardPt, studentProfile: studentProfilePt, studentStats: studentStatsPt, studentMyStats: studentMyStatsPt },
};

const COACH_FEATURES = [
  { key: "board", icon: "📋" },
  { key: "calendar", icon: "📅" },
  { key: "profile", icon: "🥊" },
  { key: "stats", icon: "📊" },
  { key: "attendance", icon: "🏆" },
];
const STUDENT_FEATURES = [
  { key: "checkin", icon: "✋" },
  { key: "today", icon: "🔥" },
  { key: "progress", icon: "📈" },
];

const primaryLink =
  "inline-flex items-center justify-center rounded-md bg-glove px-6 py-3 text-base font-semibold text-chalk shadow-lg shadow-glove/30 transition-colors hover:bg-glove-dark";
const ghostLink =
  "inline-flex items-center justify-center rounded-md border border-rope px-6 py-3 text-base font-semibold text-chalk transition-colors hover:border-smoke";

/** Public home page: what the app does, with a way into the login screen. */
export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const { planningBoard, studentProfile, studentStats, studentMyStats } =
    SCREENSHOTS[i18n.language?.startsWith("pt") ? "pt-BR" : "en"];
  const [first, ...rest] = t("brand.name").split(" ");

  return (
    <div className="min-h-screen bg-ring">
      <div className="bg-[radial-gradient(circle_at_top,_#3a0b0b_0%,_#0a0a0a_65%)]">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4" aria-label={t("landing.nav")}>
          <span className="min-w-0 font-display text-2xl tracking-wide uppercase sm:text-3xl">
            <span aria-hidden>🥊 </span>
            <span className="text-glove">{first}</span> {rest.join(" ")}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageToggle />
            <Link to="/login" className="rounded-md bg-glove px-4 py-2 text-sm font-semibold text-chalk hover:bg-glove-dark">
              {t("landing.cta")}
            </Link>
          </div>
        </header>

        <section className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-10 pb-16 text-center sm:pt-16">
          <h1 className="max-w-4xl font-display text-5xl leading-none tracking-wide break-words uppercase sm:text-7xl">
            {t("landing.headline")}
          </h1>
          <p className="mt-6 max-w-2xl text-base text-smoke sm:text-lg">{t("landing.subtitle")}</p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link to="/login" className={primaryLink}>
              {t("landing.cta")}
            </Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className={ghostLink}>
              {t("landing.github")}
            </a>
          </div>
          <img
            src={planningBoard}
            alt={t("landing.heroAlt")}
            className="mt-12 w-full rounded-xl border border-rope shadow-2xl shadow-black/60"
          />
        </section>
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16">
        <FeatureGroup title={t("landing.coachTitle")} features={COACH_FEATURES} />
        <FeatureGroup title={t("landing.studentTitle")} features={STUDENT_FEATURES} />

        <section className="flex flex-col gap-6">
          <h2 className="font-display text-4xl tracking-wide uppercase">{t("landing.showcaseTitle")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [studentProfile, "landing.showcaseProfileAlt"],
              [studentStats, "landing.showcaseStatsAlt"],
              [studentMyStats, "landing.showcaseMyStatsAlt"],
            ].map(([src, alt]) => (
              <figure key={alt} className="overflow-hidden rounded-xl border border-rope bg-canvas">
                <img src={src} alt={t(alt)} loading="lazy" className="aspect-[16/10] w-full object-cover object-top" />
                <figcaption className="p-3 text-sm text-smoke">{t(alt)}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-center gap-4 rounded-2xl border border-rope bg-[radial-gradient(circle_at_center,_#3a0b0b_0%,_#151515_70%)] px-6 py-12 text-center">
          <h2 className="font-display text-4xl tracking-wide uppercase">{t("landing.finalTitle")}</h2>
          <p className="max-w-md text-smoke">{t("landing.finalText")}</p>
          <Link to="/login" className={primaryLink}>
            {t("landing.cta")}
          </Link>
        </section>
      </main>

      <div className="pb-6">
        <AppFooter />
      </div>
    </div>
  );
}

function FeatureGroup({ title, features }: { title: string; features: { key: string; icon: string }[] }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-6">
      <h2 className="font-display text-4xl tracking-wide uppercase">{title}</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ key, icon }) => (
          <li key={key} className="rounded-xl border border-rope bg-canvas p-5">
            <span className="text-3xl" aria-hidden>
              {icon}
            </span>
            <h3 className="mt-3 text-lg font-semibold">{t(`landing.features.${key}.title`)}</h3>
            <p className="mt-1 text-sm text-smoke">{t(`landing.features.${key}.text`)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
