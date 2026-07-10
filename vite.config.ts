import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Locally we build a self-contained Node server + static client into `dist/`
// (nitro disabled), so `npm run dev` / `npm run build` / `npm run preview`
// all work out of the box. On Vercel, set NITRO_PRESET=vercel (see vercel.json)
// so the build emits a Vercel Build Output API (`.vercel/output`) with a
// Node.js serverless function for SSR + the /api/chat route.
const nitroPreset = process.env.NITRO_PRESET;

export default defineConfig({
  vite: {
    base: "/",
  },
  nitro: nitroPreset ? { preset: nitroPreset } : false,
});
