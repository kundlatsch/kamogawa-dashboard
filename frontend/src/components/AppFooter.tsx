import { Trans, useTranslation } from "react-i18next";

import { VersionButton } from "./ReleaseNotes";

/** The author's GitHub profile, linked from the footer. */
const AUTHOR_URL = "https://github.com/kundlatsch";

/** Public pages footer: app name, version (opens the release notes) and author. */
export default function AppFooter() {
  const { t } = useTranslation();
  return (
    <footer className="pt-4 text-center text-xs text-smoke">
      <Trans
        i18nKey="brand.footer"
        values={{ name: t("brand.name") }}
        components={{
          version: <VersionButton />,
          author: (
            <a
              href={AUTHOR_URL}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-glove"
            />
          ),
        }}
      />
    </footer>
  );
}
