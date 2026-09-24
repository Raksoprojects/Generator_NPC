import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";

// Repozytorium PROJEKTOWE (Raksoprojects/Generator_NPC) -> GitHub Pages serwuje
// aplikacje pod sciezka /Generator_NPC/, wiec base musi ja zawierac.
export default defineConfig({
  base: "/Generator_NPC/",
  plugins: [
    svelte(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Generator BN WFRP 4ed",
        short_name: "Generator BN",
        description: "Generator bohaterow niezaleznych do Warhammer Fantasy Roleplay 4ed",
        theme_color: "#2b2622",
        background_color: "#1a1714",
        display: "standalone",
        orientation: "any",
        lang: "pl",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      }
    })
  ],
  build: {
    target: "es2020",
    sourcemap: false
  }
});
