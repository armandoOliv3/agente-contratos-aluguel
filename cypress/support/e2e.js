// Comandos usados nos testes

const CONTRATOS = [
  'ct-2025-001.pdf', 'ct-2024-014.pdf', 'ct-2025-031.pdf', 'ct-2022-007.pdf', 'ct-2024-002.pdf', 'ct-2021-019.pdf',
  'ct-2023-045.pdf', 'ct-2025-050.pdf', 'ct-2025-063.pdf', 'ct-2026-004.pdf', 'ct-2024-030.pdf',
]

Cypress.Commands.add('todosOsContratos', () => cy.wrap(CONTRATOS.map((nome) => ({ nome }))))

// Envia PDFs para a API (multipart) pelo Node, ver cypress/tarefas/multipart.js
Cypress.Commands.add('enviarContratos', (rota, arquivos, campos = {}) =>
  cy.task('enviarMultipart', { rota, arquivos, campos }),
)

// Na tela: escolhe os PDFs, define a data base e clica em Analisar
Cypress.Commands.add('analisarNaTela', (caminhos, dataBase = Cypress.env('dataBase')) => {
  cy.get('[data-cy="input-arquivos"]').selectFile(caminhos, { force: true })
  cy.get('[data-cy="input-data-base"]').clear().type(dataBase)
  cy.get('[data-cy="botao-analisar"]').click()
})

Cypress.Commands.add('pegar', (id) => cy.get(`[data-cy="${id}"]`))
