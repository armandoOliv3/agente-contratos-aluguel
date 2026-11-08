import { beforeAll, describe, expect, it } from 'vitest'
import { criarAgenteSimulado } from '../../src/agente/agenteSimulado.js'
import { analisarArquivos } from '../../src/servico.js'
import { CONTRATOS } from '../../scripts/contratos-ficticios.js'
import { gerarPdfContrato } from '../../scripts/pdf-contrato.js'

// Data base fixa: os alertas dos contratos fictícios foram pensados para 08/11/2026
const DATA_BASE = '2026-11-08'

describe('serviço: PDFs -> relatório', () => {
  let arquivos

  beforeAll(async () => {
    arquivos = await Promise.all(CONTRATOS.map(async (c) => ({ nome: c.arquivo, conteudo: await gerarPdfContrato(c) })))
  })

  const linha = (relatorio, arquivo) => relatorio.contratos.find((c) => c.arquivo === arquivo)
  const tipos = (l) => l.alertas.map((a) => a.tipo)

  it('analisa todos os contratos fictícios', async () => {
    const r = await analisarArquivos(arquivos, { agente: criarAgenteSimulado(), dataBase: DATA_BASE })
    expect(r.agente).toBe('simulado')
    expect(r.erros).toEqual([])
    expect(r.resumo).toMatchObject({ total: 11, ativos: 9, encerrados: 1, paraRevisar: 1, comAlertas: 5 })

    expect(tipos(linha(r, 'ct-2021-019.pdf'))).toEqual(['encerrado'])
    expect(tipos(linha(r, 'ct-2024-014.pdf'))).toEqual(['fim-proximo'])
    expect(tipos(linha(r, 'ct-2023-045.pdf'))).toEqual(['indice-negativo'])
    expect(tipos(linha(r, 'ct-2026-004.pdf'))).toEqual(['reajuste-proximo'])
    expect(linha(r, 'ct-2025-050.pdf')).toMatchObject({ situacao: 'revisar', valorAtual: 1600 })
    expect(linha(r, 'ct-2025-063.pdf')).toMatchObject({ valorContratado: 3200, situacao: 'ativo' })
    expect(linha(r, 'ct-2025-031.pdf').proximoVencimento).toBe('2026-11-30')
    expect(linha(r, 'ct-2022-007.pdf').reajustes).toHaveLength(4)
  })

  it('arquivo com problema vai para a lista de erros sem derrubar os outros', async () => {
    const r = await analisarArquivos(
      [arquivos[0], { nome: 'foto.pdf', conteudo: Buffer.from('não sou pdf') }],
      { agente: criarAgenteSimulado(), dataBase: DATA_BASE },
    )
    expect(r.contratos).toHaveLength(1)
    expect(r.erros).toEqual([{ arquivo: 'foto.pdf', codigo: 'nao-e-pdf', mensagem: 'O arquivo não é um PDF' }])
  })

  it('erro do agente (ex.: API de IA fora do ar) também vira erro do arquivo', async () => {
    const agenteFalhando = { nome: 'falho', extrair: async () => { throw new Error('API indisponível') } }
    const r = await analisarArquivos([arquivos[0]], { agente: agenteFalhando, dataBase: DATA_BASE })
    expect(r.erros).toEqual([{ arquivo: 'ct-2025-001.pdf', codigo: 'erro-agente', mensagem: 'API indisponível' }])
  })
})
