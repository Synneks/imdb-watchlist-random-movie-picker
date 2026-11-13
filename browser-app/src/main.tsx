import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Picker from "./Picker.tsx";
import { createOptionsStorage } from "./storage.ts";
import { applyProviderTheme } from "./provider.ts";
import "./index.css";

// Migration and theme initialization happen once, before React's replayable render phase.
const storage = createOptionsStorage(() => window.localStorage);
const initial = storage.initialize();
applyProviderTheme(initial.options.selectedProvider);
const container = document.getElementById("picker");
if (!container) throw new Error("The page must include a #picker mount element.");

createRoot(container).render(
  <StrictMode>
    <Picker initial={initial} storage={storage} />
  </StrictMode>
);
