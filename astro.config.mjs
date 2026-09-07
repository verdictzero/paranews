// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// The update workflow passes the values GitHub Pages reports (actions/configure-pages),
// so a custom domain or a user site (base "") just works. Local builds default to the
// project-site shape.
// Pages reports an http:// origin until "Enforce HTTPS" is switched on; the
// site is served over https either way, so canonical links always say so.
const site = (process.env.SITE_URL || "https://verdictzero.github.io").replace(/^http:/, "https:");
// A custom domain reports an empty base path, which is a real value, not "unset".
const base = process.env.BASE_PATH === undefined ? "/paranews" : process.env.BASE_PATH || "/";

export default defineConfig({
  site,
  base,
  trailingSlash: "always",
  build: { format: "directory" },
  // Reader copies are fetched by the dialog, not pages to index.
  integrations: [sitemap({ filter: (page) => !page.includes("/reader/") })],
});
