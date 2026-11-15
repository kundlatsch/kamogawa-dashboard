import { useTranslation } from "react-i18next";

import { PageHeader } from "../components/ui";

/** Temporary page for sections built in later phases. */
export default function Placeholder({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <section>
      <PageHeader title={t(titleKey)} />
      <p className="text-smoke">{t("common.comingSoon")}</p>
    </section>
  );
}
