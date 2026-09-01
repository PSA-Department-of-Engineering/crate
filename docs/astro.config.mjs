import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
    base: process.env.DOCS_BASE || '/',
    integrations: [
        starlight({
            title: "Crate",
        }),
    ],
});
