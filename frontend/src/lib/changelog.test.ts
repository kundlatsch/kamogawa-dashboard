import { notesForVersion, releasesFor, type Release } from "./changelog";

const releases: Release[] = [
  { version: "0.2.0", date: "2026-12-01", sections: [] },
  { version: "0.1.0", date: "2026-11-18", sections: [] },
  { version: "0.0.1", date: "2026-11-17", sections: [] },
];

describe("notesForVersion", () => {
  it("returns the notes of the version and the releases before it", () => {
    const { current, previous } = notesForVersion(releases, "0.1.0");
    expect(current?.version).toBe("0.1.0");
    expect(previous.map((release) => release.version)).toEqual(["0.0.1"]);
  });

  it("returns no current notes for an unknown version", () => {
    const { current, previous } = notesForVersion(releases, "9.9.9");
    expect(current).toBeUndefined();
    expect(previous).toHaveLength(3);
  });
});

describe("releasesFor", () => {
  it("falls back to English for a language without a changelog", () => {
    expect(releasesFor("xx")).toBe(releasesFor("en"));
  });

  it("has notes for the current app version in every language, for the same versions", () => {
    for (const language of ["en", "pt-BR"]) {
      const { current } = notesForVersion(releasesFor(language), __APP_VERSION__);
      expect(current?.sections.length, language).toBeGreaterThan(0);
    }
    expect(releasesFor("en").map((r) => r.version)).toEqual(releasesFor("pt-BR").map((r) => r.version));
  });
});
