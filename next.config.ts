import type { NextConfig } from "next";

// Valida as variáveis de ambiente no boot (dev/build).
import "./lib/env";

const nextConfig: NextConfig = {
  // Gera .next/standalone: servidor mínimo usado na imagem Docker.
  output: "standalone",
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
