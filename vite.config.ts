import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// @pkmn/sim is a large dependency; pre-bundling it speeds up dev startup.
// `global: 'globalThis'` shims a node-ism that some bundled deps reference.
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@pkmn/sim', '@pkmn/dex', '@pkmn/data'],
  },
});
