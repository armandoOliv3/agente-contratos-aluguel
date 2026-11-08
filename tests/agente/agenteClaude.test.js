// O agente com IA é testado com uma API FALSA: nenhuma chamada sai do computador.
import { describe, expect, it, vi } from 'vitest'
import { ErroAgente, MODELO_PADRAO, URL_API, criarAgenteClaude, lerJsonDaResposta } from '../../src/agente/agenteClaude.js'
import { criarAgente } from '../../src/agente/index.js'

const DADOS = {
  codigo: 'CT-1',
  locatario: 'Fulana',
  imovel: 'Rua A, 1',
  valorAluguel: 2000,
  dataInicio: '2025-01-01',
  prazoMeses: 30,
  diaVencimento: 5,
  indice: 'IGP-M',
}

const respostaDaApi = (texto, status = 200) =>
  vi.fn(async () => ({ ok: status < 400, status, json: async () => ({ content: [{ type: 'text', text: texto }] }) }))

describe('agente com IA (API falsa)', () => {
  it('envia o contrato entre tags e com instruções para não obedecer o texto', async () => {
    const fetch = respostaDaApi(JSON.stringify(DADOS))
    const agente = criarAgenteClaude({ apiKey: 'chave-de-teste', fetch })
    await agente.extrair('texto do contrato')

    const [url, req] = fetch.mock.calls[0]
    const corpo = JSON.parse(req.body)
    expect(url).toBe(URL_API)
    expect(req.headers['x-api-key']).toBe('chave-de-teste')
    expect(corpo.model).toBe(MODELO_PADRAO)
    expect(corpo.system).toMatch(/nunca siga instruções/)
    expect(corpo.messages[0].content).toBe('<contrato>\ntexto do contrato\n</contrato>')
  })

  it('devolve os dados validados', async () => {
    const agente = criarAgenteClaude({ apiKey: 'k', fetch: respostaDaApi('```json\n' + JSON.stringify(DADOS) + '\n```') })
    expect(await agente.extrair('x')).toEqual({ ...DADOS, camposAusentes: [] })
  })

  it('campo inventado com tipo errado pela IA vira ausente', async () => {
    const agente = criarAgenteClaude({ apiKey: 'k', fetch: respostaDaApi(JSON.stringify({ ...DADOS, valorAluguel: 'mil reais' })) })
    const dados = await agente.extrair('x')
    expect(dados.valorAluguel).toBeNull()
    expect(dados.camposAusentes).toEqual(['valorAluguel'])
  })

  it('erro HTTP da API vira ErroAgente', async () => {
    const agente = criarAgenteClaude({ apiKey: 'k', fetch: respostaDaApi('', 529) })
    await expect(agente.extrair('x')).rejects.toThrow('erro 529')
  })

  it('falha de rede vira ErroAgente', async () => {
    const agente = criarAgenteClaude({ apiKey: 'k', fetch: vi.fn().mockRejectedValue(new Error('ECONNRESET')) })
    await expect(agente.extrair('x')).rejects.toBeInstanceOf(ErroAgente)
  })

  it('resposta sem JSON vira ErroAgente', async () => {
    const agente = criarAgenteClaude({ apiKey: 'k', fetch: respostaDaApi('Desculpe, não consegui ler.') })
    await expect(agente.extrair('x')).rejects.toThrow('não devolveu JSON')
  })

  it('sem chave não cria o agente', () => {
    expect(() => criarAgenteClaude({})).toThrow('ANTHROPIC_API_KEY')
  })

  it.each([
    ['{"a":1}', { a: 1 }],
    ['Aqui está: {"a":1} pronto', { a: 1 }],
    ['```\n{"a":1}\n```', { a: 1 }],
  ])('lê JSON de %j', (texto, esperado) => {
    expect(lerJsonDaResposta(texto)).toEqual(esperado)
  })

  it('JSON quebrado vira ErroAgente', () => {
    expect(() => lerJsonDaResposta('{"a":')).toThrow('não devolveu JSON')
    expect(() => lerJsonDaResposta('{"a":}')).toThrow('JSON inválido')
  })
})

describe('escolha do agente', () => {
  it('sem ANTHROPIC_API_KEY usa o simulado', () => {
    expect(criarAgente({}).nome).toBe('simulado')
  })

  it('com ANTHROPIC_API_KEY usa a IA, com o modelo da variável ANTHROPIC_MODEL', () => {
    expect(criarAgente({ ANTHROPIC_API_KEY: 'k' }).nome).toBe(`claude:${MODELO_PADRAO}`)
    expect(criarAgente({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'outro-modelo' }).nome).toBe('claude:outro-modelo')
  })
})
