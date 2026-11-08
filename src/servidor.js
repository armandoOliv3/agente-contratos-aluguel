/*
 * API do agente.
 *   GET  /api/saude                  -> serviço no ar e qual agente está ativo
 *   POST /api/contratos/analisar     -> PDFs (campo "arquivos") + "dataBase" opcional -> relatório em JSON
 *   POST /api/contratos/relatorio    -> o mesmo envio + "formato" (pdf ou xlsx) -> arquivo para baixar
 * A tela (pasta publico/) é servida na raiz e os contratos de exemplo em /exemplos/.
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import estatico from '@fastify/static'
import { criarAgente } from './agente/index.js'
import { dataValida, hoje } from './regras/datas.js'
import { gerarPdf } from './relatorio/pdf.js'
import { gerarPlanilha } from './relatorio/planilha.js'
import { nomeDoArquivo } from './relatorio/formato.js'
import { analisarArquivos } from './servico.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

export const LIMITES = { tamanhoArquivo: 5 * 1024 * 1024, quantidadeArquivos: 30 }

const FORMATOS = {
  pdf: { tipo: 'application/pdf', gerar: gerarPdf },
  xlsx: { tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', gerar: gerarPlanilha },
}

class ErroHttp extends Error {
  constructor(statusCode, mensagem) {
    super(mensagem)
    this.statusCode = statusCode
  }
}

export function criarServidor({ agente = criarAgente(), dataDeHoje = () => hoje(), logger = false } = {}) {
  const app = Fastify({ logger })

  app.register(multipart, {
    limits: { fileSize: LIMITES.tamanhoArquivo, files: LIMITES.quantidadeArquivos, fields: 10, fieldSize: 1000 },
    throwFileSizeLimit: true,
  })
  app.register(estatico, { root: join(RAIZ, 'publico') })
  app.register(estatico, { root: join(RAIZ, 'contratos'), prefix: '/exemplos/', decorateReply: false })

  // Lê o envio multipart: PDFs no campo "arquivos" e os campos de texto
  async function lerEnvio(request) {
    if (!request.isMultipart()) throw new ErroHttp(415, 'Envie os contratos como multipart/form-data')
    const arquivos = []
    const campos = {}
    for await (const parte of request.parts()) {
      if (parte.type === 'file') {
        if (parte.fieldname !== 'arquivos') {
          await parte.toBuffer()
          continue
        }
        const conteudo = await parte.toBuffer()
        if (parte.filename) arquivos.push({ nome: parte.filename, conteudo })
      } else {
        campos[parte.fieldname] = String(parte.value ?? '').trim()
      }
    }
    if (!arquivos.length) throw new ErroHttp(400, 'Nenhum contrato enviado. Use o campo "arquivos" com um ou mais PDFs')

    const dataBase = campos.dataBase || dataDeHoje()
    if (!dataValida(dataBase)) throw new ErroHttp(400, 'Data base inválida. Use o formato AAAA-MM-DD')
    return { arquivos, campos, dataBase }
  }

  async function analisar(request) {
    const { arquivos, campos, dataBase } = await lerEnvio(request)
    const relatorio = await analisarArquivos(arquivos, { agente, dataBase })
    // Nenhum arquivo pôde ser lido: não há relatório para mostrar
    if (!relatorio.contratos.length) {
      const erro = new ErroHttp(422, 'Nenhum dos arquivos pôde ser analisado')
      erro.detalhes = relatorio.erros
      throw erro
    }
    return { relatorio, campos }
  }

  app.get('/api/saude', async () => ({ status: 'ok', agente: agente.nome }))

  app.post('/api/contratos/analisar', async (request) => (await analisar(request)).relatorio)

  app.post('/api/contratos/relatorio', async (request, reply) => {
    const { relatorio, campos } = await analisar(request)
    const formato = FORMATOS[campos.formato || 'pdf']
    if (!formato) throw new ErroHttp(400, 'Formato inválido. Use pdf ou xlsx')
    const extensao = campos.formato || 'pdf'
    return reply
      .type(formato.tipo)
      .header('content-disposition', `attachment; filename="${nomeDoArquivo(relatorio.dataBase, extensao)}"`)
      .send(await formato.gerar(relatorio))
  })

  app.setErrorHandler((erro, request, reply) => {
    let status = erro.statusCode ?? 500
    let mensagem = erro.message
    if (erro.code === 'FST_REQ_FILE_TOO_LARGE') mensagem = `Arquivo maior que ${LIMITES.tamanhoArquivo / 1024 / 1024} MB`
    if (erro.code === 'FST_FILES_LIMIT') mensagem = `Envie no máximo ${LIMITES.quantidadeArquivos} arquivos por vez`
    if (erro.code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') status = 415
    if (status >= 500) {
      request.log.error(erro)
      mensagem = 'Erro interno ao processar os contratos'
    }
    reply.status(status).send({ erro: mensagem, ...(erro.detalhes ? { detalhes: erro.detalhes } : {}) })
  })

  app.setNotFoundHandler((request, reply) => reply.status(404).send({ erro: 'Rota não encontrada' }))

  return app
}
