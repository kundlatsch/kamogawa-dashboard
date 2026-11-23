import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { api } from "./api/client";
import { loadInstallDefault } from "./i18n";
import "./index.css";

void loadInstallDefault(async () => (await api.get<{ default_language?: string }>("/config/")).data);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
