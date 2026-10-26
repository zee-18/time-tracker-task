import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const projectRoot = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
);

function readServerPort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    return 3001;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    return 3001;
  }

  return port;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const port = readServerPort(env.PORT);

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: `http://localhost:${port}`,
          changeOrigin: true,
        },
      },
    },
  };
});
