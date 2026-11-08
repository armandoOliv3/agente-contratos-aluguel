// Os relatórios são lidos de volta para conferir o conteúdo, não só se o arquivo foi criado
import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { extractText, getDocumentProxy } from 'unpdf'
import { gerarPdf } from '../../src/relatorio/pdf.js'
import { gerarPlanilha } from '../../src/relatorio/planilha.js'
import { moeda, nomeDoArquivo, ordenarParaRelatorio } from '../../src/relatorio/formato.js'
import { analisarContrato, resumir } from '../../src/regras/contrato.js'

const DATA_BASE = '2026-11-08'
const TABELA = { '2025-02': { 'IGP-M': 10, IPCA: 5 }, '2026-02': { 'IGP-M': -2, IPCA: 4 } }
const base = { codigo: 'CT-A', locatario: 'Locatária Um', imovel: 'Rua A, 1', valorAluguel: 2000, dataInicio: '2024-03-01', prazoMeses: 36, diaVencimento: 10, indice: 'IGP-M' }

function montarRelatorio(contratos, erros = []) {
  const linhas = contratos.map((c, i) => ({ arquivo: `c${i}.pdf`, ...analisarContrato(c, DATA_BASE, TABELA) }))
  return { dataBase: DATA_BASE, agente: 'simulado', resumo: resumir(linhas), contratos: linhas, erros }
}

const RELATORIO = montarRelatorio(
  [
    base,
    { ...base, codigo: 'CT-B', locatario: 'Locatário Dois', indice: null },
    { ...base, codigo: 'CT-C', locatario: 'Locatário Três', dataInicio: '2021-01-01', prazoMeses: 30 },
  ],
  [{ arquivo: 'foto.pdf', codigo: 'nao-e-pdf', mensagem: 'O arquivo não é um PDF' }],
)

async function textoDoPdf(buffer) {
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(buffer)), { mergePages: true })
  return text.replace(/\s+/g, ' ')
}

describe('relatório em PDF', () => {
  it('tem resumo, contratos, valores reajustados, alertas e erros', async () => {
    const texto = await textoDoPdf(await gerarPdf(RELATORIO))
    expect(texto).toContain('Relatório de contratos de aluguel')
    expect(texto).toContain('Data base: 08/11/2026')
    expect(texto).toContain('3 contratos')
    expect(texto).toContain('1 para revisar')
    expect(texto).toContain('Locatária Um')
    expect(texto).toContain('R$ 2.200,00') // 2000 + 10% (o reajuste de -2% manteve o valor)
    expect(texto).toContain('Dados não encontrados no contrato: índice de reajuste')
    expect(texto).toContain('Contrato encerrado em 01/07/2023')
    expect(texto).toContain('foto.pdf: O arquivo não é um PDF')
  })

  it('muitos contratos: quebra em várias páginas e numera', async () => {
    const muitos = montarRelatorio(Array.from({ length: 60 }, (_, i) => ({ ...base, codigo: `CT-${String(i).padStart(3, '0')}` })))
    const pdf = await getDocumentProxy(new Uint8Array(await gerarPdf(muitos)))
    expect(pdf.numPages).toBeGreaterThan(1)
    const texto = await textoDoPdf(await gerarPdf(muitos))
    expect(texto).toContain(`Página ${pdf.numPages} de ${pdf.numPages}`)
    expect(texto).toContain('CT-059')
  })

  it('relatório sem nenhum contrato não quebra', async () => {
    const texto = await textoDoPdf(await gerarPdf(montarRelatorio([])))
    expect(texto).toContain('0 contratos')
  })
})

describe('relatório em planilha', () => {
  async function abrir(relatorio) {
    const livro = new ExcelJS.Workbook()
    await livro.xlsx.load(await gerarPlanilha(relatorio))
    return livro
  }

  it('tem as abas Resumo, Contratos e Reajustes', async () => {
    const livro = await abrir(RELATORIO)
    expect(livro.worksheets.map((a) => a.name)).toEqual(['Resumo', 'Contratos', 'Reajustes'])
  })

  it('resumo com totais e receita como número', async () => {
    const aba = (await abrir(RELATORIO)).getWorksheet('Resumo')
    expect(aba.getCell('B5').value).toBe(3)
    expect(aba.getCell('B10').value).toBe(2200)
    expect(aba.getCell('B10').numFmt).toContain('R$')
    expect(aba.getCell('B3').value).toEqual(new Date(Date.UTC(2026, 10, 8)))
    expect(aba.getCell('A12').value).toBe('foto.pdf')
  })

  it('contratos com valores numéricos, datas de verdade e o que precisa de revisão primeiro', async () => {
    const aba = (await abrir(RELATORIO)).getWorksheet('Contratos')
    expect(aba.rowCount).toBe(4)
    const cabecalho = aba.getRow(1).values.slice(1)
    expect(cabecalho).toContain('Valor atual')
    const linha2 = aba.getRow(2)
    expect(linha2.getCell(1).value).toBe('CT-B')
    expect(linha2.getCell(11).value).toBe('Revisar')
    const linha3 = aba.getRow(3)
    expect(linha3.getCell(1).value).toBe('CT-A')
    expect(linha3.getCell(7).value).toBe(2200)
    expect(linha3.getCell(8).value).toEqual(new Date(Date.UTC(2026, 10, 10)))
  })

  it('reajustes: um por linha, com o índice negativo marcado', async () => {
    const aba = (await abrir(RELATORIO)).getWorksheet('Reajustes')
    const doCtA = aba.getRows(2, aba.rowCount - 1).filter((r) => r.getCell(1).value === 'CT-A')
    expect(doCtA).toHaveLength(2)
    expect(doCtA[0].getCell(5).value).toBe(10)
    expect(doCtA[1].getCell(5).value).toBe(-2)
    expect(doCtA[1].getCell(8).value).toBe('Índice negativo: valor mantido')
  })
})

describe('formatação', () => {
  it.each([
    [2500, 'R$ 2.500,00'],
    [10651.16, 'R$ 10.651,16'],
    [0.5, 'R$ 0,50'],
    [null, '—'],
  ])('moeda(%s) = %s', (valor, esperado) => {
    expect(moeda(valor)).toBe(esperado)
  })

  it('nome do arquivo com a data base', () => {
    expect(nomeDoArquivo('2026-11-08', 'xlsx')).toBe('relatorio-contratos-2026-11-08.xlsx')
  })

  it('ordena: revisar, com alertas, sem alertas, encerrados', () => {
    const l = (codigo, situacao, alertas = 0) => ({ codigo, situacao, alertas: Array(alertas).fill({}) })
    const ordem = ordenarParaRelatorio([l('E', 'encerrado', 1), l('B', 'ativo'), l('A', 'ativo'), l('C', 'ativo', 1), l('R', 'revisar', 1)])
    expect(ordem.map((x) => x.codigo)).toEqual(['R', 'C', 'A', 'B', 'E'])
  })
})
