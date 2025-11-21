import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../dist/workflows',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // React Flow in separaten Chunk (große Library)
          reactflow: ['reactflow'],
          // React Router in separaten Chunk
          'react-router': ['react-router-dom'],
          // Radix UI Components zusammen
          'radix-ui': [
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
          ],
          // Lucide Icons (können groß werden)
          lucide: ['lucide-react'],
        },
      },
    },
  },
  base: '/',
});
