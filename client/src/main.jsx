import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { PanelProvider } from "./context/PanelContext.jsx";
import { initClickLogger } from "./lib/clickLogger.js";
import "./index.css";

// Starts the global click/error logger described in
// client/src/lib/clickLogger.js - every click on the app (and any
// uncaught JS error) gets POSTed to the backend and printed in the
// terminal running `npm run dev`, since browser console.log() never
// reaches that terminal on its own.
initClickLogger();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <CartProvider>
            <PanelProvider>
              <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  // Referencing the shared CSS variables (index.css)
                  // instead of the raw hex values directly - this inline
                  // `style` object can't use Tailwind classes, but it CAN
                  // use real CSS custom properties, so it stays wired to
                  // the same single source of truth as everything else.
                  style: {
                    background: "var(--color-bg-base)",
                    color: "var(--color-text-primary)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontSize: "14px",
                  },
                }}
              />
            </PanelProvider>
          </CartProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
