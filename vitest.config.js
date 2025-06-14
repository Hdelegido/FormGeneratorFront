import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    // Entorno de testing
    environment: 'jsdom',

    // Archivos de test - EXCLUIR accessibility
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,jsx,tsx}'],
    exclude: ['tests/e2e/**/*', 'tests/accessibility/**/*', 'node_modules/**/*'],

    // Setup global
    setupFiles: ['tests/setup.js'],

    // Configuración de cobertura
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['frontend-form/js/**/*.js'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '*.config.js',
        'frontend-form/js/rollup.config.js'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 75,
          lines: 75,
          statements: 75
        }
      }
    },

    // Reportes
    reporter: ['verbose'],

    // Timeouts
    testTimeout: 10000,

    // Variables globales
    globals: true
  },

  // Resolución de módulos
  resolve: {
    alias: {
      '@': new URL('./frontend-form/js', import.meta.url).pathname
    }
  }
});