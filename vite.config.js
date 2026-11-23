import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'kanji-meanings-zh': ['./Data/Kanji/Chinese/meanings.json'],
          'kanji-meanings-tl': ['./Data/Kanji/Tagalog/meanings.json'],
          'kanji-meanings-vi': ['./Data/Kanji/Vietnamese/meanings.json'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
