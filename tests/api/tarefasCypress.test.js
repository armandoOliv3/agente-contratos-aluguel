// As tarefas do Cypress (cy.task) rodam no Node; aqui elas são testadas sem abrir o Cypress
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { criarServidor } from '../../src/servidor.js'
import { criarAgenteSimulado } from '../../src/agente/agenteSimulado.js'
import { criarContratoPdf, enviarMultipart } from '../../cypress/tarefas/multipart.js'
import { lerTextoDoPdf } from '../../src/pdf/lerPdf.js'
import { readFileSync } from 'node:fs'

let app
let baseUrl

beforeAll(async () => {
  app = criarServidor({ agente: criarAgenteSimulado(), dataDeHoje: () => '2026-11-08' })
  await app.listen({ port: 0, host: '127.0.0.1' })
  baseUrl = `http://127.0.0.1:${app.server.address().port}`
})
afterAll(() => app.close())

describe('tarefa enviarMultipart', () => {
  it('envia PDF da pasta contratos e devolve o JSON', async () => {
    const r = await enviarMultipart({ baseUrl, rota: '/api/contratos/analisar', arquivos: [{ nome: 'ct-2025-001.pdf' }] })
    expect(r.status).toBe(200)
    expect(r.body.contratos[0].codigo).toBe('CT-2025-001')
  })

  it('envia conteúdo qualquer e arquivo de N bytes', async () => {
    const r = await enviarMultipart({ baseUrl, rota: '/api/contratos/analisar', arquivos: [{ nome: 'x.pdf', texto: 'oi' }] })
    expect(r.status).toBe(422)
    const grande = await enviarMultipart({ baseUrl, rota: '/api/contratos/analisar', arquivos: [{ nome: 'g.pdf', bytes: 6 * 1024 * 1024 }] })
    expect(grande.status).toBe(413)
  })

  it('arquivo de resposta vem como tamanho e começo', async () => {
    const r = await enviarMultipart({ baseUrl, rota: '/api/contratos/relatorio', arquivos: [{ nome: 'ct-2025-001.pdf' }], campos: { formato: 'pdf' } })
    expect(r.headers['content-type']).toBe('application/pdf')
    expect(r.body.inicio).toBe('%PDF-')
    expect(r.body.tamanho).toBeGreaterThan(1000)
  })
})

describe('tarefa criarContratoPdf', () => {
  it('grava um PDF com o texto pedido', async () => {
    const caminho = await criarContratoPdf({ nome: 'teste-tarefa.pdf', linhas: ['CONTRATO', 'Contrato nº CT-1', 'LOCATÁRIO(A): <b>Nome</b>, CPF 0.'] })
    expect(existsSync(caminho)).toBe(true)
    expect(await lerTextoDoPdf(readFileSync(caminho))).toContain('<b>Nome</b>')
  })
})
