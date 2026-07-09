import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    base: "/",
  },
  nitro: false,
  tanstackStart: {
    spa: false,
  },
});