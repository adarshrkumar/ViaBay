import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import 'dotenv/config'

// https://astro.build/config
export default defineConfig({
  output: 'server', // Enable server-side rendering for API routes
  adapter: vercel(),
});