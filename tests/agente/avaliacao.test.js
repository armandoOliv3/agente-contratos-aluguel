// Avaliação do agente lendo os PDFs de verdade (gerados em memória).
// Se uma mudança piorar a leitura, a taxa de acerto cai e este teste falha.
import { beforeAll, describe, expect, it } from 'vitest'
import { criarAgenteSimulado } from '../../src/agente/agenteSimulado.js'
import { calcularAcuracia, compararComGabarito } from '../../src/agente/avaliacao.js'
import { lerTextoDoPdf } from '../../src/pdf/lerPdf.js'
import { CONTRATOS } from '../../scripts/contratos-ficticios.js'
import { gerarPdfContrato } from '../../scripts/pdf-contrato.js'

describe('avaliação do agente simulado com os PDFs', () => {
  let resultados

  beforeAll(async () => {
    const agente = criarAgenteSimulado()
    resultados = await Promise.all(
      CONTRATOS.map(async (c) => {
        const texto = await lerTextoDoPdf(await gerarPdfContrato(c))
        return { arquivo: c.arquivo, comparacao: compararComGabarito(await agente.extrair(texto), c.esperado) }
      }),
    )
  })

  it('acerta 100% dos campos', () => {
    const { acuracia, total } = calcularAcuracia(resultados)
    expect(total).toBe(CONTRATOS.length * 8)
    expect(acuracia).toBe(1)
  })
})

describe('cálculo da taxa de acerto', () => {
  it('conta acertos por campo e no geral', () => {
    const comparacao = compararComGabarito({ codigo: 'A', valorAluguel: 10 }, { codigo: 'A', valorAluguel: 20 })
    expect(comparacao.find((c) => c.campo === 'valorAluguel')).toEqual({ campo: 'valorAluguel', esperado: 20, obtido: 10, acertou: false })
    const { acertos, total, porCampo } = calcularAcuracia([{ comparacao }])
    expect(total).toBe(8)
    expect(acertos).toBe(7) // os 6 campos ausentes nos dois lados contam como acerto (null = null)
    expect(porCampo.valorAluguel).toEqual({ acertos: 0, total: 1 })
  })

  it('sem resultados, acerto é zero', () => {
    expect(calcularAcuracia([]).acuracia).toBe(0)
  })
})
