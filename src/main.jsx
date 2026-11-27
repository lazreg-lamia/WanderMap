import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Point d'entrée : React affiche le composant App dans l'élément HTML #root.
createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
