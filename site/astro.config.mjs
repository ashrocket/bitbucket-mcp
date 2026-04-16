// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bitbucket-mcp.raiteri.net',
  output: 'static',
  build: {
    assets: 'assets',
  },
  compressHTML: true,
});
