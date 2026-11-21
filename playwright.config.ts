import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Resetea el staging (usuarios QA + seed) antes de cada ejecución. */
  globalSetup: './global-setup.ts',
  /* La app carga datos de Supabase remoto: algo más de margen que el valor por defecto. */
  timeout: 45_000,
  expect: { timeout: 10_000 },
  /* El staging es compartido y los tests cambian datos: siempre en serie. */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Sin reintentos: los tests modifican el staging (reseteado una vez por ejecución), así que
     un reintento parte de otro estado y solo produce errores engañosos. */
  retries: 0,
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["list"], ["./reporters/qa-lab-reporter.ts"], ["html", { outputFolder: "report", open: "never" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: process.env.BASE_URL,
    /* Las trazas se quedan en local/CI (llevan la contraseña QA); la captura de evidencia la hace
       fixtures/qa.ts en JPEG para cada test. */
    trace: process.env.CI ? 'off' : 'retain-on-failure', // en CI el informe es público: sin trazas
    screenshot: 'off',
  },

  /* Configure projects for major browsers */
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
