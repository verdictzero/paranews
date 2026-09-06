// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// The update workflow passes the values GitHub Pages reports (actions/configure-pages),
// so a custom domain or a user site (base "") just works. Local builds default to the
// project-site shape.
const site = process.env.SITE_URL || "https://verdictzero.github.io";
const base = process.env.BASE_PATH || "/paranews";

export default defineConfig({
  site,
  base,
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [sitemap()],
});
