import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  plugins: [react()],
  root: './src/ui',
  envDir: path.resolve(__dirname), // Load .env from project root
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    open: false
  },
  build: {
    outDir: '../../dist/ui',
    emptyOutDir: true
  }
});
