// Comandos usados nos testes
import { CONTRATOS, DATA_BASE } from './dados.js'

Cypress.Commands.add('todosOsContratos', () => cy.wrap(CONTRATOS.map((nome) => ({ nome }))))

// Envia PDFs para a API (multipart) pelo Node, ver cypress/tarefas/multipart.js
Cypress.Commands.add('enviarContratos', (rota, arquivos, campos = {}) =>
  cy.task('enviarMultipart', { rota, arquivos, campos }),
)

// Na tela: escolhe os PDFs, define a data base e clica em Analisar
Cypress.Commands.add('analisarNaTela', (caminhos, dataBase = DATA_BASE) => {
  cy.get('[data-cy="input-arquivos"]').selectFile(caminhos, { force: true })
  cy.get('[data-cy="input-data-base"]').clear().type(dataBase)
  cy.get('[data-cy="botao-analisar"]').click()
})

Cypress.Commands.add('pegar', (id) => cy.get(`[data-cy="${id}"]`))
