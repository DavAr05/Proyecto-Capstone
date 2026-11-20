import { defineConfig } from '@playwright/test';

// Pruebas end-to-end de la consola. Necesitan el backend contra el EMULADOR (puerto 4000)
// con datos sembrados; lo prepara e2e.bat en la raíz del proyecto.
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'es-CL' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
