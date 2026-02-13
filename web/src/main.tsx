import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import App from "./App";
import "@mantine/core/styles.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider
      defaultColorScheme="dark"
      theme={{
        primaryColor: "cyan",
        defaultRadius: "md",
        fontFamily: "Outfit, Segoe UI, system-ui, sans-serif",
      }}
    >
      <App />
    </MantineProvider>
  </React.StrictMode>
);
