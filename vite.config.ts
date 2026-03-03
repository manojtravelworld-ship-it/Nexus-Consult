import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/', // This ensures paths work correctly on Railway
  build: {
    outDir: 'dist', // This tells Vite where to put your final app
  }
});
