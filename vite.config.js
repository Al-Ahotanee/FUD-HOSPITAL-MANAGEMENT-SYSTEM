import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Allow the dev server to be accessed from any host (important for cloud IDEs)
    host: true,
    allowedHosts: 'all',
    proxy: {
      // Proxy all /api/* requests to the Express backend during development
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react:   ['react', 'react-dom'],
          lucide:  ['lucide-react'],
        }
      }
    }
  }
});
