import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.ALUMNO_PORT) || 5180,
    strictPort: true,
    // host:true publica la app en la red local (Wi-Fi) para abrirla desde el teléfono.
    host: true,
    proxy: {
      // La app del alumno usa el backend Express de la consola (rutas /api/v1/student/*).
      // El teléfono solo necesita llegar a este puerto; el proxy reenvía al backend.
      '/api': { target: process.env.API_TARGET || 'http://localhost:4000', changeOrigin: true },
    },
  },
});
