import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App.jsx";
import { applySavedTheme } from "./theme.js";
import "@fontsource-variable/inter";
import "./tokens.css";
import "./app.css";

applySavedTheme(); // before the first paint, so a saved theme never flashes the other one
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
