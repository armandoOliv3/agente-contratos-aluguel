// Monta o PDF de um contrato fictício e devolve o arquivo em memória (Buffer).
// Usado pelo script que grava os PDFs em contratos/ e pelos testes.
import PDFDocument from 'pdfkit'
import { textoDoContrato } from './contratos-ficticios.js'

export function gerarPdfDeTexto(texto, titulo = 'Contrato') {
  return new Promise((resolve, reject) => {
    // Data fixa nos metadados: o mesmo contrato gera sempre o mesmo arquivo
    const doc = new PDFDocument({ size: 'A4', margin: 60, info: { Title: titulo, CreationDate: new Date('2026-01-01T00:00:00Z') } })
    const partes = []
    doc.on('data', (p) => partes.push(p))
    doc.on('end', () => resolve(Buffer.concat(partes)))
    doc.on('error', reject)
    const [cabecalho, numero, ...resto] = texto.split('\n')
    doc.font('Helvetica-Bold').fontSize(14).text(cabecalho, { align: 'center' })
    doc.font('Helvetica').fontSize(10).text(numero ?? '', { align: 'center' }).moveDown()
    doc.fontSize(11)
    for (const linha of resto) {
      if (linha === '') doc.moveDown(0.6)
      else doc.text(linha, { align: 'justify', lineGap: 2 })
    }
    doc.end()
  })
}

export const gerarPdfContrato = (contrato) => gerarPdfDeTexto(textoDoContrato(contrato), contrato.esperado.codigo)
