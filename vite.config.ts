import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/asr': 'http://127.0.0.1:3001',
      '/api/tts': 'http://127.0.0.1:3001',
      '/api/sketch': 'http://127.0.0.1:3001',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          canvas: ['fabric'],
          react: ['react', 'react-dom'],
          ui: ['lucide-react', 'zustand'],
        },
      },
    },
  },
});
