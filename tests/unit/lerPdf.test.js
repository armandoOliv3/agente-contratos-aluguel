import { describe, expect, it } from 'vitest'
import PDFDocument from 'pdfkit'
import { lerTextoDoPdf, pareceSerPdf } from '../../src/pdf/lerPdf.js'
import { gerarPdfDeTexto } from '../../scripts/pdf-contrato.js'

const pdfEmBranco = () =>
  new Promise((resolve) => {
    const doc = new PDFDocument()
    const partes = []
    doc.on('data', (p) => partes.push(p))
    doc.on('end', () => resolve(Buffer.concat(partes)))
    doc.rect(50, 50, 100, 100).fill('#000') // só um desenho, como um PDF escaneado
    doc.end()
  })

describe('leitura do PDF', () => {
  it('extrai o texto, com acentos', async () => {
    const pdf = await gerarPdfDeTexto('CONTRATO DE LOCAÇÃO\nContrato nº CT-1\nLOCATÁRIO(A): João Ninguém, CPF 000.')
    expect(await lerTextoDoPdf(pdf)).toContain('LOCATÁRIO(A): João Ninguém')
  })

  it('arquivo vazio', async () => {
    await expect(lerTextoDoPdf(Buffer.alloc(0))).rejects.toMatchObject({ codigo: 'arquivo-vazio' })
  })

  it('arquivo que não é PDF (ex.: imagem renomeada para .pdf)', async () => {
    await expect(lerTextoDoPdf(Buffer.from('\x89PNG\r\n\x1a\n...'))).rejects.toMatchObject({ codigo: 'nao-e-pdf' })
  })

  it('PDF corrompido', async () => {
    const pdf = await gerarPdfDeTexto('CONTRATO\nnúmero 1\ntexto qualquer do contrato')
    await expect(lerTextoDoPdf(pdf.subarray(0, 300))).rejects.toMatchObject({ codigo: 'pdf-ilegivel' })
  })

  it('PDF sem texto (escaneado)', async () => {
    await expect(lerTextoDoPdf(await pdfEmBranco())).rejects.toMatchObject({ codigo: 'pdf-sem-texto' })
  })

  it('reconhece a assinatura %PDF-', () => {
    expect(pareceSerPdf(Buffer.from('%PDF-1.7\n'))).toBe(true)
    expect(pareceSerPdf(Buffer.from('GIF89a'))).toBe(false)
  })
})
