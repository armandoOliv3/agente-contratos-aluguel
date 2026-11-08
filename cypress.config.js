import { defineConfig } from 'cypress'
import { criarContratoPdf, enviarMultipart } from './cypress/tarefas/multipart.js'

export default defineConfig({
  e2e: {
    // O servidor precisa estar rodando (npm start) antes do Cypress
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.js',
    viewportWidth: 1280,
    viewportHeight: 900,
    video: false,
    env: {
      // Data base fixa: os alertas dos contratos fictícios foram pensados para 08/11/2026
      dataBase: '2026-11-08',
    },
    setupNodeEvents(on, config) {
      on('task', {
        enviarMultipart: (opcoes) => enviarMultipart({ baseUrl: config.baseUrl, ...opcoes }),
        criarContratoPdf,
      })
      return config
    },
  },
})
