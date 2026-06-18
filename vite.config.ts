import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: { base: "/" },
  tanstackStart: {
    spa: {
      enabled: true,
      prerender: { outputPath: "/index.html" },
    },
  },
});
