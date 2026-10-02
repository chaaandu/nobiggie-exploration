// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://nobiggie.shop',
  trailingSlash: 'never',
  integrations: [
    react(),
    sitemap({ filter: (page) => !page.includes('/render') }),
  ],
  build: {
    // One round trip fewer on patchy 4G: page CSS ships inside the HTML.
    inlineStylesheets: 'always',
    format: 'file',
  },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  devToolbar: { enabled: false },
});
