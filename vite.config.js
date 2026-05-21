import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-export': ['jspdf', 'jszip', 'file-saver'],
          'vendor-google': ['@react-oauth/google', 'gapi-script'],
          'vendor-image': ['browser-image-compression', 'heic2any'],
          'vendor-utils': ['lodash', 'date-fns', 'uuid', 'react-dropzone'],
        },
      },
    },
  },
});
