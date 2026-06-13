import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
