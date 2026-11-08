/*
 * Tarefas do Cypress que rodam no Node (cy.task).
 * O cy.request não envia arquivos em multipart/form-data, então o envio de PDFs
 * para a API é feito aqui com fetch + FormData, e o Cypress recebe só o resultado.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gerarPdfDeTexto } from '../../scripts/pdf-contrato.js'

const PASTA_CONTRATOS = 'contratos'

/*
 * arquivos: lista de { nome } (lido de contratos/), { nome, texto } (conteúdo qualquer)
 *           ou { nome, bytes } (arquivo de N bytes, para testar o limite de tamanho)
 */
export async function enviarMultipart({ baseUrl, rota, arquivos = [], campos = {} }) {
  const dados = new FormData()
  for (const a of arquivos) {
    let conteudo
    if (a.texto !== undefined) conteudo = a.texto
    else if (a.bytes !== undefined) conteudo = Buffer.alloc(a.bytes, 'a')
    else conteudo = readFileSync(join(PASTA_CONTRATOS, a.nome))
    dados.append(a.campo ?? 'arquivos', new Blob([conteudo], { type: a.tipo ?? 'application/pdf' }), a.nome)
  }
  for (const [chave, valor] of Object.entries(campos)) dados.append(chave, valor)

  const resposta = await fetch(new URL(rota, baseUrl), { method: 'POST', body: dados })
  const tipo = resposta.headers.get('content-type') ?? ''
  const headers = Object.fromEntries(resposta.headers.entries())

  if (tipo.includes('application/json')) {
    return { status: resposta.status, headers, body: await resposta.json() }
  }
  // Arquivo (PDF/planilha): devolve só o tamanho e o começo, que é o que o teste precisa
  const conteudo = Buffer.from(await resposta.arrayBuffer())
  return { status: resposta.status, headers, body: { tamanho: conteudo.length, inicio: conteudo.subarray(0, 5).toString('latin1') } }
}

// Cria um contrato em PDF na hora (ex.: com um nome malicioso) e devolve o caminho para o cy.selectFile
export async function criarContratoPdf({ nome, linhas }) {
  const pasta = join('cypress', 'fixtures', 'gerados')
  mkdirSync(pasta, { recursive: true })
  const caminho = join(pasta, nome)
  writeFileSync(caminho, await gerarPdfDeTexto(linhas.join('\n')))
  return caminho
}
