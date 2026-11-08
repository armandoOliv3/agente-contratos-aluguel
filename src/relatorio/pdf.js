// Relatório em PDF: página deitada, resumo no topo e uma tabela com os contratos
import PDFDocument from 'pdfkit'
import { SITUACOES, data, moeda, ordenarParaRelatorio, textoAlertas } from './formato.js'

const MARGEM = 36
const COLUNAS = [
  { titulo: 'Contrato', largura: 68, valor: (l) => l.codigo ?? l.arquivo },
  { titulo: 'Locatário', largura: 110, valor: (l) => l.locatario ?? '—' },
  { titulo: 'Índice', largura: 40, valor: (l) => l.indice ?? '—' },
  { titulo: 'Valor contratado', largura: 76, valor: (l) => moeda(l.valorContratado), direita: true },
  { titulo: 'Valor atual', largura: 76, valor: (l) => moeda(l.valorAtual), direita: true },
  { titulo: 'Próx. vencimento', largura: 62, valor: (l) => data(l.proximoVencimento) },
  { titulo: 'Próx. reajuste', largura: 58, valor: (l) => data(l.proximoReajuste) },
  { titulo: 'Fim', largura: 56, valor: (l) => data(l.fim) },
  { titulo: 'Situação', largura: 52, valor: (l) => SITUACOES[l.situacao] },
  { titulo: 'Alertas', largura: 172, valor: (l) => textoAlertas(l) || '—' },
]
const COR_SITUACAO = { revisar: '#B42318', encerrado: '#667085', ativo: '#101828' }

function linhaDaTabela(doc, celulas, { negrito = false, fundo, cor = '#101828' } = {}) {
  doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
  const altura = Math.max(...celulas.map((t, i) => doc.heightOfString(t, { width: COLUNAS[i].largura - 6 }))) + 8
  const fimDaPagina = doc.page.height - MARGEM - 14
  if (doc.y + altura > fimDaPagina) {
    doc.addPage()
    if (!negrito) linhaDaTabela(doc, COLUNAS.map((c) => c.titulo), { negrito: true, fundo: '#1F4E5F', cor: '#FFFFFF' })
    doc.font('Helvetica').fontSize(7.5)
  }
  const y = doc.y
  const larguraTotal = COLUNAS.reduce((s, c) => s + c.largura, 0)
  if (fundo) doc.rect(MARGEM, y, larguraTotal, altura).fill(fundo)
  let x = MARGEM
  celulas.forEach((texto, i) => {
    doc.fillColor(cor).text(texto, x + 3, y + 4, { width: COLUNAS[i].largura - 6, align: COLUNAS[i].direita ? 'right' : 'left' })
    x += COLUNAS[i].largura
  })
  doc.moveTo(MARGEM, y + altura).lineTo(MARGEM + larguraTotal, y + altura).lineWidth(0.5).strokeColor('#D0D5DD').stroke()
  doc.x = MARGEM
  doc.y = y + altura
}

export function gerarPdf(relatorio) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: MARGEM,
      bufferPages: true,
      info: { Title: `Relatório de contratos - ${data(relatorio.dataBase)}`, CreationDate: new Date(`${relatorio.dataBase}T12:00:00Z`) },
    })
    const partes = []
    doc.on('data', (p) => partes.push(p))
    doc.on('end', () => resolve(Buffer.concat(partes)))
    doc.on('error', reject)

    const r = relatorio.resumo
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#101828').text('Relatório de contratos de aluguel')
    doc.font('Helvetica').fontSize(9).fillColor('#475467')
      .text(`Data base: ${data(relatorio.dataBase)}   ·   Agente: ${relatorio.agente}`)
      .moveDown(0.6)
    doc.fillColor('#101828').fontSize(10)
      .text(
        `${r.total} contratos   ·   ${r.ativos} ativos   ·   ${r.encerrados} encerrados   ·   ${r.paraRevisar} para revisar   ·   ` +
          `${r.comAlertas} com alertas   ·   Receita mensal dos ativos: ${moeda(r.receitaMensal)}`,
      )
      .moveDown(0.8)

    linhaDaTabela(doc, COLUNAS.map((c) => c.titulo), { negrito: true, fundo: '#1F4E5F', cor: '#FFFFFF' })
    for (const l of ordenarParaRelatorio(relatorio.contratos)) {
      linhaDaTabela(doc, COLUNAS.map((c) => c.valor(l)), { cor: COR_SITUACAO[l.situacao] })
    }

    if (relatorio.erros.length) {
      doc.moveDown().font('Helvetica-Bold').fontSize(10).fillColor('#B42318').text('Arquivos não analisados')
      doc.font('Helvetica').fontSize(8.5)
      for (const e of relatorio.erros) doc.text(`${e.arquivo}: ${e.mensagem}`)
    }

    // Rodapé com número da página
    const paginas = doc.bufferedPageRange()
    for (let i = 0; i < paginas.count; i++) {
      doc.switchToPage(i)
      doc.font('Helvetica').fontSize(7).fillColor('#98A2B3').text(
        `Valores de índice ilustrativos (projeto de estudo).   Página ${i + 1} de ${paginas.count}`,
        MARGEM,
        doc.page.height - MARGEM,
        { lineBreak: false },
      )
    }
    doc.end()
  })
}
