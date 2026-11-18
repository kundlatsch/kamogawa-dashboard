import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { notesForVersion, releasesFor, type Release } from "../lib/changelog";
import { formatDate } from "../lib/dates";
import { Button, Modal } from "./ui";

/** The current app version as a link-style button that opens what changed in it. */
export function VersionButton({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("releaseNotes.open")}
        className={`underline decoration-dotted underline-offset-2 hover:text-chalk ${className}`}
      >
        v{__APP_VERSION__}
      </button>
      {/* Portal: the button sits inside footers whose text styles must not leak into the modal. */}
      {open && createPortal(<ReleaseNotesModal version={__APP_VERSION__} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

export function ReleaseNotesModal({ version, onClose }: { version: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { current, previous } = notesForVersion(releasesFor(i18n.language), version);

  return (
    <Modal title={t("releaseNotes.title", { version })} onClose={onClose}>
      <div className="-mr-2 flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-2">
        {current ? <ReleaseBody release={current} /> : <p className="text-sm text-smoke">{t("releaseNotes.none")}</p>}
        {previous.length > 0 && (
          <details className="rounded-lg border border-rope p-3">
            <summary className="cursor-pointer text-sm font-medium text-smoke hover:text-chalk">
              {t("releaseNotes.previous")}
            </summary>
            <div className="mt-3 flex flex-col gap-4">
              {previous.map((release) => (
                <div key={release.version}>
                  <h3 className="font-display text-lg tracking-wide uppercase">v{release.version}</h3>
                  <ReleaseBody release={release} />
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </Modal>
  );
}

function ReleaseBody({ release }: { release: Release }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-smoke">
        {t("releaseNotes.releasedOn", {
          date: formatDate(release.date, i18n.language, { day: "numeric", month: "long", year: "numeric" }),
        })}
      </p>
      {release.sections.map((section) => (
        <section key={section.title}>
          <h4 className="mb-1 text-sm font-semibold text-glove">{section.title}</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
