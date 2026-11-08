import { DATA_BASE as dataBase } from '../../support/dados.js'

const ROTA = '/api/contratos/analisar'

describe('API: análise dos contratos', () => {
  it('analisa os 11 contratos fictícios', () => {
    cy.todosOsContratos().then((arquivos) => {
      cy.enviarContratos(ROTA, arquivos, { dataBase }).then(({ status, body }) => {
        expect(status).to.eq(200)
        expect(body.agente).to.eq('simulado')
        expect(body.resumo).to.include({ total: 11, ativos: 9, encerrados: 1, paraRevisar: 1, comAlertas: 5 })
        expect(body.erros).to.be.empty
      })
    })
  })

  it('contrato padrão: valores, datas e reajuste calculados', () => {
    cy.enviarContratos(ROTA, [{ nome: 'ct-2025-001.pdf' }], { dataBase }).then(({ body }) => {
      const [c] = body.contratos
      expect(c).to.include({
        codigo: 'CT-2025-001',
        locatario: 'Ana Paula Ribeiro',
        indice: 'IGP-M',
        valorContratado: 2500,
        fim: '2027-09-01',
        proximoVencimento: '2026-11-10',
        proximoReajuste: '2027-03-01',
        situacao: 'ativo',
      })
      expect(c.reajustes).to.have.length(1)
      expect(c.valorAtual).to.be.greaterThan(2500)
    })
  })

  it('ignora a instrução escondida no contrato (prompt injection)', () => {
    cy.enviarContratos(ROTA, [{ nome: 'ct-2025-063.pdf' }], { dataBase }).then(({ body }) => {
      const [c] = body.contratos
      expect(c.valorContratado).to.eq(3200)
      expect(c.proximoVencimento).to.eq('2026-12-07')
      expect(c.indice).to.eq('IPCA')
    })
  })

  it('vencimento no dia 31 cai no último dia do mês', () => {
    cy.enviarContratos(ROTA, [{ nome: 'ct-2025-031.pdf' }], { dataBase }).then(({ body }) => {
      expect(body.contratos[0].vencimentos).to.deep.eq(['2026-11-30', '2026-12-31', '2027-01-31'])
    })
  })

  it('alertas de cada situação', () => {
    const casos = [
      ['ct-2021-019.pdf', 'encerrado'],
      ['ct-2024-014.pdf', 'fim-proximo'],
      ['ct-2023-045.pdf', 'indice-negativo'],
      ['ct-2026-004.pdf', 'reajuste-proximo'],
      ['ct-2025-050.pdf', 'dados-incompletos'],
    ]
    cy.enviarContratos(ROTA, casos.map(([nome]) => ({ nome })), { dataBase }).then(({ body }) => {
      casos.forEach(([arquivo, tipo]) => {
        const c = body.contratos.find((x) => x.arquivo === arquivo)
        expect(c.alertas.map((a) => a.tipo), arquivo).to.deep.eq([tipo])
      })
    })
  })

  it('a data base muda o resultado', () => {
    cy.enviarContratos(ROTA, [{ nome: 'ct-2024-014.pdf' }], { dataBase: '2027-02-01' }).its('body.contratos.0.situacao').should('eq', 'encerrado')
  })

  it('arquivo inválido junto com PDFs bons: 200 e o arquivo vai para erros', () => {
    cy.enviarContratos(ROTA, [{ nome: 'ct-2025-001.pdf' }, { nome: 'foto.pdf', texto: 'não sou um pdf' }], { dataBase }).then(({ status, body }) => {
      expect(status).to.eq(200)
      expect(body.contratos).to.have.length(1)
      expect(body.erros).to.deep.eq([{ arquivo: 'foto.pdf', codigo: 'nao-e-pdf', mensagem: 'O arquivo não é um PDF' }])
    })
  })

  it('nenhum arquivo legível: 422', () => {
    cy.enviarContratos(ROTA, [{ nome: 'planilha.xlsx', texto: 'PK', tipo: 'application/vnd.ms-excel' }]).then(({ status, body }) => {
      expect(status).to.eq(422)
      expect(body.detalhes[0].codigo).to.eq('nao-e-pdf')
    })
  })

  it('sem arquivos: 400', () => {
    cy.enviarContratos(ROTA, [], { dataBase }).then(({ status, body }) => {
      expect(status).to.eq(400)
      expect(body.erro).to.contain('Nenhum contrato enviado')
    })
  })

  ;['08/11/2026', '2026-02-30'].forEach((invalida) => {
    it(`data base inválida (${invalida}): 400`, () => {
      cy.enviarContratos(ROTA, [{ nome: 'ct-2025-001.pdf' }], { dataBase: invalida }).its('status').should('eq', 400)
    })
  })

  it('arquivo maior que 5 MB: 413', () => {
    cy.enviarContratos(ROTA, [{ nome: 'grande.pdf', bytes: 5 * 1024 * 1024 + 1 }]).then(({ status, body }) => {
      expect(status).to.eq(413)
      expect(body.erro).to.contain('maior que 5 MB')
    })
  })
})

describe('API: download do relatório', () => {
  const ROTA_RELATORIO = '/api/contratos/relatorio'

  it('PDF', () => {
    cy.todosOsContratos().then((arquivos) => {
      cy.enviarContratos(ROTA_RELATORIO, arquivos, { dataBase, formato: 'pdf' }).then(({ status, headers, body }) => {
        expect(status).to.eq(200)
        expect(headers['content-type']).to.eq('application/pdf')
        expect(headers['content-disposition']).to.contain('relatorio-contratos-2026-11-08.pdf')
        expect(body.inicio).to.eq('%PDF-')
      })
    })
  })

  it('planilha (xlsx)', () => {
    cy.enviarContratos(ROTA_RELATORIO, [{ nome: 'ct-2025-001.pdf' }], { dataBase, formato: 'xlsx' }).then(({ status, headers, body }) => {
      expect(status).to.eq(200)
      expect(headers['content-type']).to.contain('spreadsheetml')
      expect(body.inicio.slice(0, 2)).to.eq('PK') // .xlsx é um arquivo zip
    })
  })

  it('formato desconhecido: 400', () => {
    cy.enviarContratos(ROTA_RELATORIO, [{ nome: 'ct-2025-001.pdf' }], { formato: 'docx' }).then(({ status, body }) => {
      expect(status).to.eq(400)
      expect(body.erro).to.eq('Formato inválido. Use pdf ou xlsx')
    })
  })
})
