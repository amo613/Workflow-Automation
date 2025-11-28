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
    chunkSizeWarningLimit: 1000, // Erhöhe Limit auf 1MB für Warnung
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // WICHTIG: React-Core muss im Hauptbundle bleiben!
          // Prüfe zuerst, ob es React-Core ist (nicht andere React-Libraries)
          const isReactCore = 
            (id.includes('node_modules/react/') || id.includes('node_modules/react/index')) &&
            !id.includes('reactflow') &&
            !id.includes('react-router') &&
            !id.includes('react-hook-form') &&
            !id.includes('react-bits');
          
          const isReactDOM = 
            (id.includes('node_modules/react-dom/') || id.includes('node_modules/react-dom/index')) &&
            !id.includes('reactflow');
          
          if (isReactCore || isReactDOM) {
            return; // React-Core bleibt im Hauptbundle (undefined = kein separater Chunk)
          }
          
          // Three.js in separaten Chunk (sehr große Library, nur für LandingPage)
          if (id.includes('three')) {
            return 'three';
          }
          
          // React Flow in separaten Chunk (große Library)
          if (id.includes('reactflow')) {
            return 'reactflow';
          }
          
          // React Router in separaten Chunk
          if (id.includes('react-router-dom')) {
            return 'react-router';
          }
          
          // Radix UI Components zusammen
          if (id.includes('@radix-ui')) {
            return 'radix-ui';
          }
          
          // Lucide Icons (können groß werden)
          if (id.includes('lucide-react')) {
            return 'lucide';
          }
          
          // Form Libraries zusammen
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
            return 'form-libs';
          }
          
          // Sonner (Toast Library)
          if (id.includes('sonner')) {
            return 'sonner';
          }
          
          // Node modules in vendor chunk (aber nicht React-Core!)
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  base: '/',
});
