import type { NextConfig } from "next";

// Valida as variáveis de ambiente no boot (dev/build).
import { basePath } from "./lib/env";

const nextConfig: NextConfig = {
  // Gera .next/standalone: servidor mínimo usado na imagem Docker.
  output: "standalone",
  // Prefixo público derivado de APP_URL. É fixado no build: mudar APP_URL exige rebuild.
  // O proxy reverso deve repassar o caminho completo (sem remover o prefixo).
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
