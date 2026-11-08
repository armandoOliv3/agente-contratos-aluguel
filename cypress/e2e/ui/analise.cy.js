import { DATA_BASE } from '../../support/dados.js'

const contrato = (nome) => `contratos/${nome}`

describe('Tela: análise dos contratos', () => {
  beforeEach(() => cy.visit('/'))

  it('mostra o agente ativo e a data de hoje como data base', () => {
    cy.pegar('modo-agente').should('have.text', 'agente: simulado')
    cy.pegar('input-data-base').invoke('val').should('match', /^\d{4}-\d{2}-\d{2}$/)
  })

  it('analisa um contrato e mostra a linha na tabela', () => {
    cy.analisarNaTela(contrato('ct-2025-001.pdf'))
    cy.pegar('resumo-total').should('contain', '1')
    cy.pegar('linha-CT-2025-001').within(() => {
      cy.contains('Ana Paula Ribeiro')
      cy.contains('R$ 2.500,00')
      cy.contains('10/11/2026')
      cy.contains('Ativo')
    })
  })

  it('analisa vários contratos e mostra os alertas', () => {
    cy.analisarNaTela(['ct-2021-019.pdf', 'ct-2024-014.pdf', 'ct-2025-050.pdf', 'ct-2026-004.pdf'].map(contrato))
    cy.pegar('resumo-total').should('contain', '4')
    cy.pegar('resumo-revisar').should('contain', '1')
    cy.pegar('linha-CT-2021-019').find('[data-cy="alerta-encerrado"]').should('contain', 'Contrato encerrado em 01/12/2023')
    cy.pegar('linha-CT-2024-014').find('[data-cy="alerta-fim-proximo"]').should('contain', 'termina em 54 dias')
    cy.pegar('linha-CT-2025-050').should('have.class', 'revisar').and('contain', 'índice de reajuste')
    cy.pegar('linha-CT-2026-004').find('[data-cy="alerta-reajuste-proximo"]').should('contain', '01/12/2026')
  })

  it('o que precisa de revisão aparece primeiro na tabela', () => {
    cy.analisarNaTela(['ct-2025-001.pdf', 'ct-2025-050.pdf'].map(contrato))
    cy.get('[data-cy="tabela-contratos"] tbody tr').first().should('have.attr', 'data-cy', 'linha-CT-2025-050')
  })

  it('carrega os 11 contratos de exemplo pelo link', () => {
    cy.pegar('link-exemplos').click()
    cy.pegar('arquivos-escolhidos').should('contain', '11 arquivo(s)')
    cy.pegar('input-data-base').clear().type(DATA_BASE)
    cy.pegar('botao-analisar').click()
    cy.get('[data-cy="tabela-contratos"] tbody tr').should('have.length', 11)
    cy.pegar('resumo-receita').should('contain', 'R$')
  })

  it('arquivo que não é PDF junto com contratos bons aparece na lista de erros', () => {
    cy.pegar('input-arquivos').selectFile(
      [contrato('ct-2025-001.pdf'), { contents: Cypress.Buffer.from('não sou pdf'), fileName: 'foto.pdf', mimeType: 'application/pdf' }],
      { force: true },
    )
    cy.pegar('botao-analisar').click()
    cy.pegar('erros-arquivos').should('be.visible').and('contain', 'foto.pdf: O arquivo não é um PDF')
  })

  it('só arquivo inválido: mostra o erro e nenhuma tabela', () => {
    cy.pegar('input-arquivos').selectFile({ contents: Cypress.Buffer.from('oi'), fileName: 'nota.pdf' }, { force: true })
    cy.pegar('botao-analisar').click()
    cy.pegar('mensagem-erro').should('be.visible').and('contain', 'Nenhum dos arquivos pôde ser analisado').and('contain', 'nota.pdf')
    cy.pegar('resultado').should('not.be.visible')
  })

  it('sem arquivo escolhido: pede um contrato e não chama a API', () => {
    cy.intercept('POST', '/api/contratos/analisar').as('analisar')
    cy.pegar('botao-analisar').click()
    cy.pegar('mensagem-erro').should('have.text', 'Escolha pelo menos um contrato em PDF.')
    cy.get('@analisar.all').should('have.length', 0)
  })

  it('enquanto analisa: botão desativado e aviso de carregando', () => {
    cy.intercept('POST', '/api/contratos/analisar', (req) => req.continue((res) => res.setDelay(800))).as('analisar')
    cy.analisarNaTela(contrato('ct-2025-001.pdf'))
    cy.pegar('botao-analisar').should('be.disabled')
    cy.pegar('carregando').should('be.visible')
    cy.wait('@analisar')
    cy.pegar('botao-analisar').should('be.enabled')
    cy.pegar('carregando').should('not.be.visible')
  })

  it('servidor fora do ar: mostra mensagem amigável', () => {
    cy.intercept('POST', '/api/contratos/analisar', { forceNetworkError: true })
    cy.analisarNaTela(contrato('ct-2025-001.pdf'))
    cy.pegar('mensagem-erro').should('contain', 'Não foi possível falar com o servidor')
  })

  it('texto do contrato não vira HTML na tela (nome com código malicioso)', () => {
    const nomeMalicioso = '<img src=x onerror="window.invadido=true">'
    cy.task('criarContratoPdf', {
      nome: 'malicioso.pdf',
      linhas: [
        'CONTRATO DE LOCAÇÃO RESIDENCIAL',
        'Contrato nº CT-2026-666',
        `LOCATÁRIO(A): ${nomeMalicioso}, CPF 000.000.000-00.`,
        'IMÓVEL: Rua Teste, 1, Uberaba/MG.',
        'CLÁUSULA 1 – DO PRAZO: A locação terá prazo de 30 (trinta) meses, com início em 01/01/2026.',
        'CLÁUSULA 2 – DO VALOR: O aluguel mensal é de R$ 1.000,00 (mil reais), com vencimento todo dia 5 de cada mês.',
        'CLÁUSULA 3 – DO REAJUSTE: Reajuste anual pela variação do IPCA.',
      ],
    }).then((caminho) => cy.analisarNaTela(caminho))
    cy.pegar('linha-CT-2026-666').should('contain', nomeMalicioso)
    cy.pegar('linha-CT-2026-666').find('img').should('not.exist')
    cy.window().then((janela) => expect(janela.invadido).to.be.undefined)
  })
})

describe('Tela: download do relatório', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.analisarNaTela(['ct-2025-001.pdf', 'ct-2022-007.pdf'].map(contrato))
    cy.pegar('resultado').should('be.visible')
  })

  it('baixa o PDF', () => {
    cy.intercept('POST', '/api/contratos/relatorio').as('relatorio')
    cy.pegar('baixar-pdf').click()
    cy.wait('@relatorio').then(({ request, response }) => {
      expect(request.headers['content-type']).to.contain('multipart/form-data')
      expect(response.statusCode).to.eq(200)
      expect(response.headers['content-type']).to.eq('application/pdf')
    })
    cy.readFile('cypress/downloads/relatorio-contratos-2026-11-08.pdf', 'binary', { timeout: 10000 }).should((conteudo) => {
      expect(conteudo.slice(0, 5)).to.eq('%PDF-')
    })
  })

  it('baixa a planilha', () => {
    cy.intercept('POST', '/api/contratos/relatorio').as('relatorio')
    cy.pegar('baixar-planilha').click()
    cy.wait('@relatorio').its('response.headers.content-disposition').should('contain', 'relatorio-contratos-2026-11-08.xlsx')
    cy.readFile('cypress/downloads/relatorio-contratos-2026-11-08.xlsx', 'binary', { timeout: 10000 }).should('have.length.greaterThan', 1000)
  })
})

describe('Tela: celular', () => {
  it('cabe na tela sem rolagem para os lados (a tabela rola dentro do quadro)', () => {
    cy.viewport('iphone-se2')
    cy.visit('/')
    cy.analisarNaTela(['ct-2025-001.pdf', 'ct-2025-050.pdf'].map(contrato))
    cy.pegar('resultado').should('be.visible')
    cy.document().its('documentElement.scrollWidth').should('be.lte', 375)
  })

  // Receita de milhões é o valor mais longo da tela: o texto não pode passar da borda do cartão
  ;[
    ['iPhone SE (375 px)', 375, 667],
    ['tela de 320 px', 320, 568],
  ].forEach(([nome, largura, altura]) => {
    it(`${nome}: os valores do resumo cabem dentro dos cartões, mesmo com receita de milhões`, () => {
      cy.intercept('POST', '/api/contratos/analisar', (req) =>
        req.continue((res) => {
          res.body.resumo.receitaMensal = 1234567.89
        }),
      )
      cy.viewport(largura, altura)
      cy.visit('/')
      cy.analisarNaTela(['ct-2025-001.pdf', 'ct-2025-050.pdf'].map(contrato))
      cy.pegar('resumo-receita').contains('1.234.567,89')
      cy.get('.cartao strong').each(($valor) => {
        const cartao = $valor.parent().attr('data-cy')
        // scrollWidth maior que clientWidth = texto vazando do cartão
        expect($valor[0].scrollWidth, `valor do ${cartao}`).to.be.lte($valor[0].clientWidth)
      })
    })
  })
})
