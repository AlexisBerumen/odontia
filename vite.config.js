import { defineConfig } from 'vite';

export default defineConfig({
  preview: {
    // Dominio público generado para este despliegue en Railway.
    allowedHosts: ['odontia-production-7790.up.railway.app'],
  },
});
