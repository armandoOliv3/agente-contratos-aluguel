import { describe, expect, it } from 'vitest'
import {
  analisarContrato,
  arredondar,
  camposInvalidos,
  datasDeReajuste,
  fimDoContrato,
  historicoDeReajustes,
  proximosVencimentos,
  resumir,
} from '../../src/regras/contrato.js'
import { INDICES, variacaoAcumulada } from '../../src/regras/indices.js'

// Tabela pequena com valores redondos: dá para conferir as contas de cabeça
const TABELA = {
  '2025-02': { 'IGP-M': 10, IPCA: 5 },
  '2026-02': { 'IGP-M': -2, IPCA: 4 },
  '2026-06': { 'IGP-M': 3.5, IPCA: 4.5 },
}

const contrato = (extra = {}) => ({
  codigo: 'CT-TESTE',
  locatario: 'Ana Souza',
  imovel: 'Rua A, 10',
  valorAluguel: 2000,
  dataInicio: '2024-03-01',
  prazoMeses: 36,
  diaVencimento: 10,
  indice: 'IGP-M',
  ...extra,
})

describe('Vencimentos', () => {
  it('fim do contrato = início + prazo', () => {
    expect(fimDoContrato(contrato())).toBe('2027-03-01')
    expect(fimDoContrato(contrato({ dataInicio: '2025-01-31', prazoMeses: 13 }))).toBe('2026-02-28')
  })

  it('próximos 3 vencimentos a partir da data base', () => {
    expect(proximosVencimentos(contrato(), '2026-11-08')).toEqual(['2026-11-10', '2026-12-10', '2027-01-10'])
  })

  it('se o vencimento do mês já passou, começa no mês seguinte', () => {
    expect(proximosVencimentos(contrato(), '2026-11-11')[0]).toBe('2026-12-10')
  })

  it('vencimento no próprio dia da data base conta', () => {
    expect(proximosVencimentos(contrato(), '2026-11-10')[0]).toBe('2026-11-10')
  })

  it('dia 31 cai no último dia de meses curtos', () => {
    const c = contrato({ diaVencimento: 31 })
    expect(proximosVencimentos(c, '2027-01-05')).toEqual(['2027-01-31', '2027-02-28'])
  })

  it('não passa do fim do contrato', () => {
    expect(proximosVencimentos(contrato(), '2027-01-20')).toEqual(['2027-02-10'])
  })

  it('contrato que ainda não começou não tem vencimento antes do início', () => {
    const c = contrato({ dataInicio: '2026-11-20', diaVencimento: 10 })
    expect(proximosVencimentos(c, '2026-11-08')).toEqual(['2026-12-10', '2027-01-10', '2027-02-10'])
  })
})

describe('Reajustes', () => {
  it('reajuste a cada 12 meses do início, até antes do fim', () => {
    expect(datasDeReajuste(contrato())).toEqual(['2025-03-01', '2026-03-01'])
  })

  it('início em 29/02: aniversário em 28/02 nos anos comuns', () => {
    expect(datasDeReajuste(contrato({ dataInicio: '2024-02-29', prazoMeses: 60 }))).toEqual([
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ])
  })

  it('aplica a variação acumulada do mês anterior ao aniversário', () => {
    const h = historicoDeReajustes(contrato(), '2025-06-01', TABELA)
    expect(h.aplicados).toEqual([
      { data: '2025-03-01', referencia: '2025-02', variacao: 10, anterior: 2000, novo: 2200, mantido: false },
    ])
    expect(h.valorAtual).toBe(2200)
  })

  it('índice negativo não reduz o aluguel: o valor é mantido', () => {
    const h = historicoDeReajustes(contrato(), '2026-11-08', TABELA)
    expect(h.aplicados.map((r) => [r.novo, r.mantido])).toEqual([
      [2200, false],
      [2200, true],
    ])
    expect(h.valorAtual).toBe(2200)
  })

  it('IPCA usa a coluna do IPCA (2000 → +5% = 2100 → +4% = 2184)', () => {
    expect(historicoDeReajustes(contrato({ indice: 'IPCA' }), '2026-11-08', TABELA).valorAtual).toBe(2184)
  })

  it('reajuste ainda não chegou: vale o valor contratado', () => {
    expect(historicoDeReajustes(contrato(), '2025-02-28', TABELA).valorAtual).toBe(2000)
  })

  it('sem dado do índice para o mês de referência: para e avisa qual mês faltou', () => {
    const h = historicoDeReajustes(contrato({ dataInicio: '2023-03-01' }), '2026-11-08', TABELA)
    expect(h.indisponivel).toBe('2024-02')
    expect(h.valorAtual).toBe(2000)
  })

  it('arredonda para centavos', () => {
    expect(arredondar(1234.5678)).toBe(1234.57)
    expect(arredondar(0.1 + 0.2)).toBe(0.3)
  })

  it('a tabela padrão tem dados de 2022 a outubro de 2026 para os dois índices', () => {
    expect(variacaoAcumulada('IGP-M', '2022-01')).toBeTypeOf('number')
    expect(variacaoAcumulada('IPCA', '2026-10')).toBeTypeOf('number')
    expect(variacaoAcumulada('IPCA', '2026-11')).toBeNull()
    expect(variacaoAcumulada('INCC', '2025-01')).toBeNull()
    expect(Object.keys(INDICES)).toHaveLength(58)
  })
})

describe('Validação dos dados extraídos', () => {
  it('contrato completo não tem problemas', () => {
    expect(camposInvalidos(contrato())).toEqual([])
  })

  it.each([
    ['codigo', { codigo: null }],
    ['locatario', { locatario: '' }],
    ['valorAluguel', { valorAluguel: 0 }],
    ['valorAluguel', { valorAluguel: '2000' }],
    ['dataInicio', { dataInicio: '01/03/2024' }],
    ['prazoMeses', { prazoMeses: 12.5 }],
    ['diaVencimento', { diaVencimento: 32 }],
    ['indice', { indice: null }],
    ['indice', { indice: 'INCC' }],
  ])('aponta %s inválido', (campo, extra) => {
    expect(camposInvalidos(contrato(extra))).toEqual([campo])
  })

  it('sem dados nenhum, aponta todos os obrigatórios', () => {
    expect(camposInvalidos(null)).toHaveLength(7)
  })
})

describe('Análise do contrato (linha do relatório)', () => {
  it('contrato ativo: valor atual, vencimentos, próximo reajuste e sem alertas', () => {
    const l = analisarContrato(contrato(), '2025-06-01', TABELA)
    expect(l).toMatchObject({
      codigo: 'CT-TESTE',
      situacao: 'ativo',
      valorContratado: 2000,
      valorAtual: 2200,
      fim: '2027-03-01',
      proximoVencimento: '2025-06-10',
      proximoReajuste: '2026-03-01',
    })
    expect(l.alertas).toEqual([])
  })

  it('avisa quando o reajuste está a 30 dias ou menos', () => {
    const l = analisarContrato(contrato(), '2026-02-01', TABELA)
    expect(l.alertas.map((a) => a.tipo)).toEqual(['reajuste-proximo'])
  })

  it('avisa quando o contrato termina em 60 dias ou menos', () => {
    const l = analisarContrato(contrato(), '2027-01-15', TABELA)
    expect(l.alertas.map((a) => a.tipo)).toContain('fim-proximo')
    expect(l.alertas.find((a) => a.tipo === 'fim-proximo').mensagem).toBe('Contrato termina em 45 dias: avaliar renovação')
  })

  it('contrato encerrado: sem vencimentos nem próximo reajuste', () => {
    const l = analisarContrato(contrato({ dataInicio: '2022-01-10', prazoMeses: 30 }), '2026-11-08', INDICES)
    expect(l.situacao).toBe('encerrado')
    expect(l.vencimentos).toEqual([])
    expect(l.proximoReajuste).toBeNull()
    expect(l.alertas[0]).toEqual({ tipo: 'encerrado', mensagem: 'Contrato encerrado em 10/07/2024' })
  })

  it('avisa quando o último reajuste teve índice negativo', () => {
    const l = analisarContrato(contrato(), '2026-03-05', TABELA)
    expect(l.alertas.map((a) => a.tipo)).toContain('indice-negativo')
  })

  it('sem índice de reajuste: calcula o que dá e pede revisão', () => {
    const l = analisarContrato(contrato({ indice: null }), '2025-06-01', TABELA)
    expect(l.situacao).toBe('revisar')
    expect(l.valorAtual).toBe(2000)
    expect(l.proximoVencimento).toBe('2025-06-10')
    expect(l.reajustes).toEqual([])
    expect(l.alertas[0].mensagem).toBe('Dados não encontrados no contrato: índice de reajuste')
  })

  it('sem data de início: não calcula prazos e pede revisão', () => {
    const l = analisarContrato(contrato({ dataInicio: null }), '2025-06-01', TABELA)
    expect(l).toMatchObject({ situacao: 'revisar', fim: null, proximoVencimento: null, valorAtual: null })
  })

  it('sem dia de vencimento: não lista vencimentos', () => {
    const l = analisarContrato(contrato({ diaVencimento: null }), '2025-06-01', TABELA)
    expect(l.vencimentos).toEqual([])
    expect(l.valorAtual).toBe(2200)
  })

  it('sem valor do aluguel: não inventa valor', () => {
    const l = analisarContrato(contrato({ valorAluguel: null }), '2025-06-01', TABELA)
    expect(l.valorAtual).toBeNull()
  })

  it('índice sem dado: avisa no relatório', () => {
    const l = analisarContrato(contrato({ dataInicio: '2023-03-01' }), '2026-11-08', TABELA)
    expect(l.alertas.map((a) => a.tipo)).toContain('indice-indisponivel')
  })

  it('resumo soma a receita só dos contratos ativos', () => {
    const linhas = [
      analisarContrato(contrato(), '2025-06-01', TABELA),
      analisarContrato(contrato({ valorAluguel: 1000.5 }), '2025-06-01', TABELA),
      analisarContrato(contrato({ dataInicio: '2020-01-01', prazoMeses: 12 }), '2025-06-01', TABELA),
      analisarContrato(contrato({ indice: null }), '2025-06-01', TABELA),
    ]
    expect(resumir(linhas)).toEqual({ total: 4, ativos: 2, encerrados: 1, paraRevisar: 1, comAlertas: 2, receitaMensal: 3300.55 })
  })
})
