import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { authStore } from "./store/authStore";
import "leaflet/dist/leaflet.css";

authStore.getState().hydrate();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
