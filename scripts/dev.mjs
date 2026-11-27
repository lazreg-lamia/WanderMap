// Lance en même temps le serveur API (port 3001) et le site Vite (port 5173) avec une seule commande : npm run dev
import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const run = (script) => spawn(isWindows ? "npm.cmd" : "npm", ["run", script], { stdio: "inherit", shell: isWindows });

const children = [run("server"), run("client")];
const stop = () => { children.forEach((child) => child.kill()); process.exit(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((child) => child.on("exit", (code) => { if (code) stop(); }));
