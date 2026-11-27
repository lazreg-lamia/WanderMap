import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite compile le React (JSX). En développement, toutes les requêtes /api sont
// redirigées vers le serveur Node (port 3001) : le navigateur ne voit qu'une seule adresse.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:3001" },
  },
});
