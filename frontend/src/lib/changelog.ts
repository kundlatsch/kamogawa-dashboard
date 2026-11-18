import ptBR from "../changelog/pt-BR.json";

export interface ReleaseSection {
  title: string;
  items: string[];
}

export interface Release {
  version: string;
  /** ISO date (YYYY-MM-DD) the version was released. */
  date: string;
  sections: ReleaseSection[];
}

// Release notes live in `src/changelog/<language>.json`, newest first.
// To add a language, create the file with the same shape and register it here.
const changelogs: Record<string, Release[]> = {
  "pt-BR": ptBR,
};

const FALLBACK_LANGUAGE = "pt-BR";

export function releasesFor(language: string): Release[] {
  return changelogs[language] ?? changelogs[FALLBACK_LANGUAGE];
}

/** Splits the changelog into the notes for `version` and every release before it. */
export function notesForVersion(releases: Release[], version: string) {
  const index = releases.findIndex((release) => release.version === version);
  if (index === -1) return { current: undefined, previous: releases };
  return { current: releases[index], previous: releases.slice(index + 1) };
}
