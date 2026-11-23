import "@testing-library/jest-dom/vitest";

import i18n from "../i18n";

// Tests assert on the Portuguese copy; start every test in pt-BR with no saved language choice.
beforeEach(async () => {
  localStorage.removeItem("cbt.language");
  await i18n.changeLanguage("pt-BR");
});
