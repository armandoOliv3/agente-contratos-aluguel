// Relatório em planilha (.xlsx) com três abas: Resumo, Contratos e Reajustes
import ExcelJS from 'exceljs'
import { partes } from '../regras/datas.js'
import { SITUACOES, ordenarParaRelatorio, textoAlertas } from './formato.js'

const FORMATO_MOEDA = '"R$" #,##0.00'
const FORMATO_DATA = 'dd/mm/yyyy'

// "2026-11-08" -> Date (a planilha mostra como data de verdade, dá para ordenar e filtrar)
const comoData = (texto) => {
  if (!texto) return null
  const { ano, mes, dia } = partes(texto)
  return new Date(Date.UTC(ano, mes - 1, dia))
}

function estilizarCabecalho(aba) {
  const cabecalho = aba.getRow(1)
  cabecalho.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cabecalho.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E5F' } }
  aba.views = [{ state: 'frozen', ySplit: 1 }]
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: aba.columnCount } }
}

export async function gerarPlanilha(relatorio) {
  const livro = new ExcelJS.Workbook()
  livro.creator = 'agente-contratos-aluguel'
  livro.created = comoData(relatorio.dataBase)

  const resumo = livro.addWorksheet('Resumo')
  resumo.columns = [{ width: 28 }, { width: 22 }]
  const r = relatorio.resumo
  resumo.addRows([
    ['Relatório de contratos de aluguel'],
    [],
    ['Data base', comoData(relatorio.dataBase)],
    ['Agente', relatorio.agente],
    ['Contratos analisados', r.total],
    ['Ativos', r.ativos],
    ['Encerrados', r.encerrados],
    ['Para revisar', r.paraRevisar],
    ['Com alertas', r.comAlertas],
    ['Receita mensal (ativos)', r.receitaMensal],
    ['Arquivos com erro', relatorio.erros.length],
  ])
  resumo.getCell('A1').font = { bold: true, size: 14 }
  resumo.getCell('B3').numFmt = FORMATO_DATA
  resumo.getCell('B10').numFmt = FORMATO_MOEDA
  for (const e of relatorio.erros) resumo.addRow([e.arquivo, e.mensagem])

  const contratos = livro.addWorksheet('Contratos')
  contratos.columns = [
    { header: 'Contrato', key: 'codigo', width: 14 },
    { header: 'Arquivo', key: 'arquivo', width: 18 },
    { header: 'Locatário', key: 'locatario', width: 28 },
    { header: 'Imóvel', key: 'imovel', width: 44 },
    { header: 'Índice', key: 'indice', width: 8 },
    { header: 'Valor contratado', key: 'valorContratado', width: 16, style: { numFmt: FORMATO_MOEDA } },
    { header: 'Valor atual', key: 'valorAtual', width: 14, style: { numFmt: FORMATO_MOEDA } },
    { header: 'Próximo vencimento', key: 'proximoVencimento', width: 18, style: { numFmt: FORMATO_DATA } },
    { header: 'Próximo reajuste', key: 'proximoReajuste', width: 16, style: { numFmt: FORMATO_DATA } },
    { header: 'Fim do contrato', key: 'fim', width: 15, style: { numFmt: FORMATO_DATA } },
    { header: 'Situação', key: 'situacao', width: 11 },
    { header: 'Alertas', key: 'alertas', width: 60 },
  ]
  for (const l of ordenarParaRelatorio(relatorio.contratos)) {
    contratos.addRow({
      ...l,
      proximoVencimento: comoData(l.proximoVencimento),
      proximoReajuste: comoData(l.proximoReajuste),
      fim: comoData(l.fim),
      situacao: SITUACOES[l.situacao],
      alertas: textoAlertas(l),
    })
  }
  estilizarCabecalho(contratos)

  const reajustes = livro.addWorksheet('Reajustes')
  reajustes.columns = [
    { header: 'Contrato', key: 'codigo', width: 14 },
    { header: 'Data do reajuste', key: 'data', width: 16, style: { numFmt: FORMATO_DATA } },
    { header: 'Índice', key: 'indice', width: 8 },
    { header: 'Mês de referência', key: 'referencia', width: 17 },
    { header: 'Variação (%)', key: 'variacao', width: 12, style: { numFmt: '0.00' } },
    { header: 'Valor anterior', key: 'anterior', width: 15, style: { numFmt: FORMATO_MOEDA } },
    { header: 'Novo valor', key: 'novo', width: 14, style: { numFmt: FORMATO_MOEDA } },
    { header: 'Observação', key: 'obs', width: 30 },
  ]
  for (const l of relatorio.contratos) {
    for (const rj of l.reajustes) {
      reajustes.addRow({ codigo: l.codigo, indice: l.indice, ...rj, data: comoData(rj.data), obs: rj.mantido ? 'Índice negativo: valor mantido' : '' })
    }
  }
  estilizarCabecalho(reajustes)

  return Buffer.from(await livro.xlsx.writeBuffer())
}
