import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Picker from "./Picker.tsx";
import "./index.css";

createRoot(document.getElementById("picker")!).render(
  <StrictMode>
    <Picker />
  </StrictMode>
);
