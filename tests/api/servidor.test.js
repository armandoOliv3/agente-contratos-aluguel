// Testes da API com o servidor rodando de verdade (porta aleatória) e fetch + FormData
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { LIMITES, criarServidor } from '../../src/servidor.js'
import { criarAgenteSimulado } from '../../src/agente/agenteSimulado.js'
import { CONTRATOS } from '../../scripts/contratos-ficticios.js'
import { gerarPdfContrato } from '../../scripts/pdf-contrato.js'

let app
let url
let pdfs

beforeAll(async () => {
  app = criarServidor({ agente: criarAgenteSimulado(), dataDeHoje: () => '2026-11-08' })
  await app.listen({ port: 0, host: '127.0.0.1' })
  url = `http://127.0.0.1:${app.server.address().port}`
  pdfs = Object.fromEntries(await Promise.all(CONTRATOS.map(async (c) => [c.arquivo, await gerarPdfContrato(c)])))
})

afterAll(() => app.close())

const envio = (arquivos, campos = {}) => {
  const dados = new FormData()
  for (const [nome, conteudo, tipo = 'application/pdf'] of arquivos) dados.append('arquivos', new Blob([conteudo], { type: tipo }), nome)
  for (const [k, v] of Object.entries(campos)) dados.append(k, v)
  return dados
}
const post = (rota, body, headers) => fetch(`${url}${rota}`, { method: 'POST', body, headers })
const todos = () => Object.entries(pdfs).map(([nome, conteudo]) => [nome, conteudo])

describe('GET /api/saude', () => {
  it('responde com o agente ativo', async () => {
    const r = await fetch(`${url}/api/saude`)
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ status: 'ok', agente: 'simulado' })
  })
})

describe('POST /api/contratos/analisar', () => {
  it('analisa os 11 contratos fictícios', async () => {
    const r = await post('/api/contratos/analisar', envio(todos(), { dataBase: '2026-11-08' }))
    expect(r.status).toBe(200)
    const corpo = await r.json()
    expect(corpo.resumo).toMatchObject({ total: 11, ativos: 9, encerrados: 1, paraRevisar: 1 })
    expect(corpo.contratos.find((c) => c.codigo === 'CT-2025-063').valorContratado).toBe(3200)
  })

  it('sem data base, usa a data de hoje', async () => {
    const r = await post('/api/contratos/analisar', envio([['a.pdf', pdfs['ct-2025-001.pdf']]]))
    expect((await r.json()).dataBase).toBe('2026-11-08')
  })

  it('a data base muda o resultado (mesmo contrato, outro dia)', async () => {
    const r = await post('/api/contratos/analisar', envio([['a.pdf', pdfs['ct-2024-014.pdf']]], { dataBase: '2027-02-01' }))
    expect((await r.json()).contratos[0].situacao).toBe('encerrado')
  })

  it('arquivo inválido junto com PDFs bons: 200 e o arquivo vai para erros', async () => {
    const r = await post('/api/contratos/analisar', envio([['a.pdf', pdfs['ct-2025-001.pdf']], ['foto.pdf', 'não sou pdf']]))
    const corpo = await r.json()
    expect(r.status).toBe(200)
    expect(corpo.erros).toEqual([{ arquivo: 'foto.pdf', codigo: 'nao-e-pdf', mensagem: 'O arquivo não é um PDF' }])
  })

  it('nenhum arquivo legível: 422 com o motivo de cada um', async () => {
    const r = await post('/api/contratos/analisar', envio([['planilha.xlsx', 'PK...', 'application/vnd.ms-excel']]))
    expect(r.status).toBe(422)
    expect(await r.json()).toEqual({
      erro: 'Nenhum dos arquivos pôde ser analisado',
      detalhes: [{ arquivo: 'planilha.xlsx', codigo: 'nao-e-pdf', mensagem: 'O arquivo não é um PDF' }],
    })
  })

  it('sem arquivos: 400', async () => {
    const dados = new FormData()
    dados.append('dataBase', '2026-11-08')
    const r = await post('/api/contratos/analisar', dados)
    expect(r.status).toBe(400)
    expect((await r.json()).erro).toMatch(/Nenhum contrato enviado/)
  })

  it('arquivo em outro campo que não "arquivos" é ignorado: 400', async () => {
    const dados = new FormData()
    dados.append('documento', new Blob([pdfs['ct-2025-001.pdf']]), 'a.pdf')
    expect((await post('/api/contratos/analisar', dados)).status).toBe(400)
  })

  it.each(['08/11/2026', '2026-02-30', 'amanhã'])('data base inválida (%s): 400', async (dataBase) => {
    const r = await post('/api/contratos/analisar', envio([['a.pdf', pdfs['ct-2025-001.pdf']]], { dataBase }))
    expect(r.status).toBe(400)
    expect((await r.json()).erro).toMatch(/Data base inválida/)
  })

  it('JSON no lugar de multipart: 415', async () => {
    const r = await post('/api/contratos/analisar', JSON.stringify({ arquivos: [] }), { 'content-type': 'application/json' })
    expect(r.status).toBe(415)
  })

  it('arquivo maior que o limite: 413', async () => {
    const grande = Buffer.alloc(LIMITES.tamanhoArquivo + 1, 'a')
    const r = await post('/api/contratos/analisar', envio([['grande.pdf', grande]]))
    expect(r.status).toBe(413)
    expect((await r.json()).erro).toMatch(/maior que 5 MB/)
  })

  it('arquivos demais: 413', async () => {
    const muitos = Array.from({ length: LIMITES.quantidadeArquivos + 1 }, (_, i) => [`c${i}.pdf`, pdfs['ct-2025-001.pdf']])
    const r = await post('/api/contratos/analisar', envio(muitos))
    expect(r.status).toBe(413)
    expect((await r.json()).erro).toMatch(/no máximo 30 arquivos/)
  })

  it('erro inesperado não vaza detalhes internos: 500', async () => {
    const quebrado = criarServidor({ agente: criarAgenteSimulado(), dataDeHoje: () => { throw new Error('segredo interno') } })
    const dados = envio([['a.pdf', pdfs['ct-2025-001.pdf']]])
    await quebrado.listen({ port: 0, host: '127.0.0.1' })
    const resp = await fetch(`http://127.0.0.1:${quebrado.server.address().port}/api/contratos/analisar`, { method: 'POST', body: dados })
    expect(resp.status).toBe(500)
    expect(await resp.json()).toEqual({ erro: 'Erro interno ao processar os contratos' })
    await quebrado.close()
  })
})

describe('POST /api/contratos/relatorio', () => {
  it('PDF por padrão, com nome do arquivo pela data base', async () => {
    const r = await post('/api/contratos/relatorio', envio(todos(), { dataBase: '2026-11-08' }))
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="relatorio-contratos-2026-11-08.pdf"')
    expect(Buffer.from(await r.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('planilha (xlsx) com os 11 contratos', async () => {
    const r = await post('/api/contratos/relatorio', envio(todos(), { dataBase: '2026-11-08', formato: 'xlsx' }))
    expect(r.headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const livro = new ExcelJS.Workbook()
    await livro.xlsx.load(Buffer.from(await r.arrayBuffer()))
    expect(livro.getWorksheet('Contratos').rowCount).toBe(12)
  })

  it('formato desconhecido: 400', async () => {
    const r = await post('/api/contratos/relatorio', envio([['a.pdf', pdfs['ct-2025-001.pdf']]], { formato: 'docx' }))
    expect(r.status).toBe(400)
    expect((await r.json()).erro).toBe('Formato inválido. Use pdf ou xlsx')
  })
})

describe('tela e exemplos', () => {
  it('serve a tela na raiz', async () => {
    const r = await fetch(url)
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('Agente de Contratos')
  })

  it('serve os contratos de exemplo', async () => {
    const r = await fetch(`${url}/exemplos/gabarito.json`)
    expect(r.status).toBe(200)
  })

  it('rota inexistente: 404 em JSON', async () => {
    const r = await fetch(`${url}/api/nao-existe`)
    expect(r.status).toBe(404)
    expect(await r.json()).toEqual({ erro: 'Rota não encontrada' })
  })
})
