// Tira o texto de um PDF. O agente trabalha só com esse texto.
import { extractText, getDocumentProxy } from 'unpdf'

export class ErroPdf extends Error {
  constructor(mensagem, codigo) {
    super(mensagem)
    this.name = 'ErroPdf'
    this.codigo = codigo
  }
}

const ASSINATURA_PDF = '%PDF-'

export function pareceSerPdf(buffer) {
  return Buffer.from(buffer.subarray(0, 1024)).toString('latin1').includes(ASSINATURA_PDF)
}

export async function lerTextoDoPdf(buffer) {
  if (!buffer?.length) throw new ErroPdf('Arquivo vazio', 'arquivo-vazio')
  if (!pareceSerPdf(buffer)) throw new ErroPdf('O arquivo não é um PDF', 'nao-e-pdf')

  let texto
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    ;({ text: texto } = await extractText(pdf, { mergePages: true }))
  } catch {
    throw new ErroPdf('Não foi possível abrir o PDF (arquivo corrompido ou protegido)', 'pdf-ilegivel')
  }

  // PDF escaneado (só imagem) não tem texto para ler
  if (!texto || texto.trim().length < 20) throw new ErroPdf('O PDF não tem texto (pode ser um documento escaneado)', 'pdf-sem-texto')
  return texto
}
