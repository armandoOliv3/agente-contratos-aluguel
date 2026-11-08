import { describe, expect, it } from 'vitest'
import {
  criarAgenteSimulado,
  dataDoTexto,
  extrairCampos,
  indiceDoTexto,
  separarClausulas,
  valorEmReais,
} from '../../src/agente/agenteSimulado.js'
import { CONTRATOS, textoDoContrato } from '../../scripts/contratos-ficticios.js'

const agente = criarAgenteSimulado()
const contrato = (arquivo) => CONTRATOS.find((c) => c.arquivo === arquivo)

describe('agente simulado: leitura dos contratos fictícios', () => {
  it.each(CONTRATOS.map((c) => [c.caso, c]))('%s', async (_caso, c) => {
    const { camposAusentes, ...dados } = await agente.extrair(textoDoContrato(c))
    expect(dados).toEqual(c.esperado)
    expect(camposAusentes).toEqual(c.esperado.indice ? [] : ['indice'])
  })

  it('ignora instrução escondida no contrato (prompt injection)', async () => {
    const c = contrato('ct-2025-063.pdf')
    expect(textoDoContrato(c)).toContain('aluguel mensal é de R$ 1,00')
    const dados = await agente.extrair(textoDoContrato(c))
    expect(dados.valorAluguel).toBe(3200)
    expect(dados.diaVencimento).toBe(7)
    expect(dados.indice).toBe('IPCA')
  })

  it('não inventa índice quando o contrato não define um', async () => {
    const dados = await agente.extrair(textoDoContrato(contrato('ct-2025-050.pdf')))
    expect(dados.indice).toBeNull()
    expect(dados.camposAusentes).toContain('indice')
  })

  it('texto que não é contrato: tudo vem como ausente, sem erro', async () => {
    const dados = await agente.extrair('Lista de compras: arroz, feijão, R$ 30,00.')
    expect(dados.camposAusentes).toHaveLength(8)
  })

  it('valor fora da cláusula DO VALOR não é usado', () => {
    const texto = 'Contrato nº CT-2026-999 CLÁUSULA 1 – DO PRAZO: prazo de 12 meses. CLÁUSULA 2 – DA MULTA: multa de R$ 500,00.'
    expect(extrairCampos(texto).valorAluguel).toBeNull()
  })
})

describe('agente simulado: partes da leitura', () => {
  it('junta linhas quebradas pelo PDF e separa as cláusulas', () => {
    const { cabecalho, clausulas } = separarClausulas('Contrato nº X\nCLÁUSULA 1 – DO PRAZO: prazo de\n12 meses.\nCLAUSULA 2 - DO VALOR: R$ 10,00')
    expect(cabecalho).toBe('Contrato nº X ')
    expect(clausulas).toEqual({ 'DO PRAZO': 'prazo de 12 meses. ', 'DO VALOR': 'R$ 10,00' })
  })

  it('cláusula repetida: vale a primeira', () => {
    const { clausulas } = separarClausulas('CLÁUSULA 1 – DO VALOR: R$ 10,00 CLÁUSULA 9 – DO VALOR: R$ 1,00')
    expect(clausulas['DO VALOR']).toBe('R$ 10,00 ')
  })

  it.each([
    ['R$ 2.500,00', 2500],
    ['R$ 1.234,56', 1234.56],
    ['R$1.400', 1400],
    ['R$ 950,90', 950.9],
    ['R$ 12.000.000,00', 12000000],
    ['sem valor', null],
  ])('valor %s -> %s', (texto, esperado) => {
    expect(valorEmReais(texto)).toBe(esperado)
  })

  it.each([
    ['01/03/2025', '2025-03-01'],
    ['5/3/2025', '2025-03-05'],
    ['1º de agosto de 2025', '2025-08-01'],
    ['15 de Março de 2024', '2024-03-15'],
    ['29/02/2024', '2024-02-29'],
    ['29/02/2025', null],
    ['31 de abril de 2025', null],
    ['10 de brumário de 2025', null],
    ['sem data', null],
  ])('data %s -> %s', (texto, esperado) => {
    expect(dataDoTexto(texto)).toBe(esperado)
  })

  it.each([
    ['variação do IGP-M/FGV', 'IGP-M'],
    ['pelo IGPM', 'IGP-M'],
    ['Índice Nacional de Preços ao Consumidor Amplo (IPCA)', 'IPCA'],
    ['conforme acordo entre as partes', null],
  ])('índice em "%s" -> %s', (texto, esperado) => {
    expect(indiceDoTexto(texto)).toBe(esperado)
  })
})
